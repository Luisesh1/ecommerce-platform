import { ShippingRuleType } from '../enums';

export interface ShippingZone {
  id: string;
  name: string;
  countries: string[];
  states?: string[];
  postalCodes?: string[];
  isDefault: boolean;
  methods: ShippingMethod[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ShippingMethod {
  id: string;
  zoneId: string;
  name: string;
  description?: string;
  type: ShippingRuleType;
  price: number;
  minOrderAmount?: number;
  maxOrderAmount?: number;
  minWeight?: number;
  maxWeight?: number;
  freeShippingThreshold?: number;
  isActive: boolean;
  sortOrder: number;
  estimatedDaysMin?: number;
  estimatedDaysMax?: number;
  carrier?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaxRate {
  id: string;
  name: string;
  country: string;
  state?: string;
  postalCode?: string;
  rate: number;
  isInclusive: boolean;
  taxCode?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
