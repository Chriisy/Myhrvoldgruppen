export * from './labels';

// Re-export role constants from auth validator
export { ROLES } from '../validators/auth';

// Re-export status constants
export { VISIT_STATUS, VISIT_TYPE, AGREEMENT_STATUS } from '../validators/service';
export { CUSTOMER_SEGMENT, SUPPLIER_CATEGORY, PRODUCT_CATEGORY } from '../validators/crm';
