export interface EDIHeader {
  interchangeControlNumber: string
  functionalGroupControlNumber?: string
  transactionSetControlNumber: string
  documentType: string
}

export interface LineItem {
  lineNumber: string
  quantity: number
  uom: string
  unitPrice: number
  productId: string
  timestamp: string
}

export interface BatchInfo {
  items: LineItem[]
  count: number
  timestamp: string
}

export enum DocumentStatus {
  Queued = 'queued',
  Processing = 'processing',
  ParseError = 'parse_error',
  Processed = 'processed',
  SendingToShopify = 'sending_to_shopify',
  Completed = 'completed',
  Error = 'error',
}

export interface Document {
  id: string
  status: DocumentStatus
  originalFilePath: string
  rawContent: string
  parsedContent?: string
  error?: string
  createdAt: string
  updatedAt: string
  metadata?: Record<string, unknown>
}

export interface POItem {
  lineNumber: string
  quantity: number
  uom: string
  price: number
  productId: string
}

export interface EDISegment {
  tag: string
  elements: string[]
}

export interface FTPConfig {
  host: string
  port: number
  username: string
  password: string
  directory: string // e.g., "/850"
}

export interface PurchaseOrder {
  header: {
    senderId: string // From ISA
    receiverId: string // From ISA
    poNumber: string // From BEG
    date: string // From BEG
  }
  billTo: {
    name: string
    accountNumber: string
  }
  shipTo: {
    name: string
    accountNumber: string
  }
  items: Array<{
    lineNumber: string
    quantity: number
    uom: string
    price: number
    productId: string // UPC code
  }>
  totalItems: number
}
