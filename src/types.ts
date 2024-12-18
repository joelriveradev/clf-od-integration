export interface FTPConfig {
  host: string
  port: number
  username: string
  password: string
  directory: string
}

export interface PurchaseOrder {
  header: {
    senderId: string
    senderQualifier: string
    receiverId: string
    receiverQualifier: string
    poNumber: string
    controlNumber: string
    date: string
  }
  billTo: {
    name: string
    customerId: string
  }
  shipTo: {
    name: string
    customerId: string
  }
  items: Array<{
    lineNumber: string
    quantity: number
    uom: string
    price: number
    productId: string
  }>
  totalItems: number
}
