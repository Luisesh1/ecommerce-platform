import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import { toDataURL } from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { RegisterDto } from './dto/register.dto';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    emailVerified: boolean;
    twoFactorEnabled: boolean;
  };
  tokens: TokenPair;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly SALT_ROUNDS = 12;
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCK_DURATION_MS = 15 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async register(dto: RegisterDto): Promise<{ message: string }> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, this.SALT_ROUNDS);
    const emailVerificationToken = uuidv4();

    await this.prisma.user.create({
      data: {
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        passwordHash,
        phone: dto.phone,
        marketingConsent: dto.marketingConsent ?? false,
        emailVerificationToken,
      },
    });

    try {
      await this.emailService.sendVerificationEmail(dto.email, emailVerificationToken);
    } catch (err) {
      this.logger.error(`Failed to send verification email: ${(err as Error).message}`);
    }

    return { message: 'Registration successful. Please check your email to verify your account.' };
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return null;

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account temporarily locked due to too many failed login attempts');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      const attempts = user.loginAttempts + 1;
      const updateData: any = { loginAttempts: attempts };
      if (attempts >= this.MAX_LOGIN_ATTEMPTS) {
        updateData.lockedUntil = new Date(Date.now() + this.LOCK_DURATION_MS);
        updateData.loginAttempts = 0;
      }
      await this.prisma.user.update({ where: { id: user.id }, data: updateData });
      return null;
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    return user;
  }

  async login(
    email: string,
    password: string,
    totpCode?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponse | { requiresTwoFactor: true }> {
    const user = await this.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const twoFactor = await this.prisma.userTwoFactor.findUnique({ where: { userId: user.id } });
    if (twoFactor?.enabled) {
      if (!totpCode) {
        return { requiresTwoFactor: true };
      }
      const isValidCode = authenticator.verify({ token: totpCode, secret: twoFactor.secret });
      if (!isValidCode) {
        throw new UnauthorizedException('Invalid 2FA code');
      }
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { loginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role, ipAddress, userAgent);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        emailVerified: user.emailVerified,
        twoFactorEnabled: twoFactor?.enabled ?? false,
      },
      tokens,
    };
  }

  async refreshToken(token: string): Promise<TokenPair> {
    let payload: any;
    try {
      payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const session = await this.prisma.userSession.findUnique({
      where: { refreshToken: token },
      include: { user: true },
    });

    if (!session || !session.isValid || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    if (!session.user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    await this.prisma.userSession.update({
      where: { id: session.id },
      data: { isValid: false },
    });

    return this.generateTokens(
      session.user.id,
      session.user.email,
      session.user.role,
      session.ipAddress ?? undefined,
      session.userAgent ?? undefined,
    );
  }

  async logout(refreshToken: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { refreshToken },
      data: { isValid: false },
    });
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findFirst({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, emailVerificationToken: null },
    });

    return { message: 'Email verified successfully' };
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const message = 'If an account with that email exists, a password reset link has been sent.';

    if (!user) return { message };

    const resetToken = uuidv4();
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: `reset:${resetToken}:${resetExpiry.getTime()}`,
      },
    });

    try {
      await this.emailService.sendPasswordResetEmail(email, resetToken);
    } catch (err) {
      this.logger.error(`Failed to send password reset email: ${(err as Error).message}`);
    }

    return { message };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findFirst({
      where: { emailVerificationToken: { startsWith: `reset:${token}:` } },
    });

    if (!user || !user.emailVerificationToken) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const parts = user.emailVerificationToken.split(':');
    const expiryTime = parseInt(parts[2] || '0', 10);
    if (Date.now() > expiryTime) {
      throw new BadRequestException('Reset token has expired');
    }

    const passwordHash = await bcrypt.hash(newPassword, this.SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, emailVerificationToken: null },
    });

    await this.prisma.userSession.updateMany({
      where: { userId: user.id },
      data: { isValid: false },
    });

    return { message: 'Password reset successfully' };
  }

  async setup2FA(userId: string): Promise<{ secret: string; otpauthUrl: string; qrCodeDataUrl: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const existing = await this.prisma.userTwoFactor.findUnique({ where: { userId } });
    if (existing?.enabled) {
      throw new BadRequestException('2FA is already enabled');
    }

    const secret = authenticator.generateSecret();
    const appName = this.configService.get<string>('APP_NAME', 'Ecommerce');
    const otpauthUrl = authenticator.keyuri(user.email, appName, secret);
    const qrCodeDataUrl = await toDataURL(otpauthUrl);

    const backupCodes = Array.from({ length: 10 }, () => uuidv4().replace(/-/g, '').substring(0, 10));

    if (existing) {
      await this.prisma.userTwoFactor.update({
        where: { userId },
        data: { secret, backupCodes, enabled: false },
      });
    } else {
      await this.prisma.userTwoFactor.create({
        data: { userId, secret, backupCodes, enabled: false },
      });
    }

    return { secret, otpauthUrl, qrCodeDataUrl };
  }

  async verify2FA(userId: string, code: string): Promise<{ message: string; backupCodes: string[] }> {
    const twoFactor = await this.prisma.userTwoFactor.findUnique({ where: { userId } });
    if (!twoFactor) {
      throw new BadRequestException('2FA setup not started. Call setup first.');
    }

    const isValid = authenticator.verify({ token: code, secret: twoFactor.secret });
    if (!isValid) {
      throw new BadRequestException('Invalid TOTP code');
    }

    await this.prisma.userTwoFactor.update({
      where: { userId },
      data: { enabled: true },
    });

    return { message: '2FA enabled successfully', backupCodes: twoFactor.backupCodes };
  }

  async disable2FA(userId: string, code: string): Promise<{ message: string }> {
    const twoFactor = await this.prisma.userTwoFactor.findUnique({ where: { userId } });
    if (!twoFactor || !twoFactor.enabled) {
      throw new BadRequestException('2FA is not enabled');
    }

    const isValid = authenticator.verify({ token: code, secret: twoFactor.secret });
    if (!isValid) {
      throw new BadRequestException('Invalid TOTP code');
    }

    await this.prisma.userTwoFactor.delete({ where: { userId } });

    return { message: '2FA disabled successfully' };
  }

  private async generateTokens(
    userId: string,
    email: string,
    role: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<TokenPair> {
    const payload = { sub: userId, email, role };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '15m'),
    });

    const refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: refreshExpiresIn,
    });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.userSession.create({
      data: {
        userId,
        refreshToken,
        ipAddress,
        userAgent,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }
}
