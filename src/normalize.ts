import { toLowerCaseKeys } from '@/lib/edination/utils.ts'
import { PurchaseOrder } from '@/types.ts'

export async function normalize(interchanges: unknown) {
  if (!Array.isArray(interchanges)) {
    return
  }

  if (!interchanges || interchanges.length === 0) {
    throw new Error('No X12 interchange data provided.')
  }

  const data = toLowerCaseKeys(interchanges)
  const firstInterchange = data[0] // Use the first interchange in the array
  const firstGroup = firstInterchange.groups?.[0] // Use the first group in the interchange

  if (!firstGroup) {
    throw new Error('No functional groups found in the interchange.')
  }

  const transaction = firstGroup.transactions?.find(
    (txn: any) => txn.st.transactionsetidentifiercode_01 === '850'
  ) // Find the first 850 Purchase Order transaction

  if (!transaction) {
    throw new Error('No 850 Purchase Order transaction found.')
  }

  // Extract Bill To and Ship To information
  const n1Loop = transaction.n1loop || []

  const billTo =
    n1Loop.find((n1: any) => {
      const BY = n1.n1.entityidentifiercode_01 === 'BY'
      const BT = n1.n1.entityidentifiercode_01 === 'BT'
      return BY || BT
    }) || {}

  const shipTo =
    n1Loop.find((n1: any) => n1.n1.entityidentifiercode_01 === 'ST') || {}

  // Extract Line Items
  const items = (transaction.po1loop || []).map((po1Item: any) => ({
    lineNumber: po1Item.po1.assignedidentification_01,
    quantity: parseInt(po1Item.po1.quantityordered_02, 10),
    uom: po1Item.po1.unitorbasisformeasurementcode_03,
    price: parseFloat(po1Item.po1.unitprice_04),
    productId: po1Item.po1.productserviceid_07
  }))

  // Construct the PurchaseOrder object
  const purchaseOrder: PurchaseOrder = {
    header: {
      senderId: firstGroup.gs.senderidcode_2, // Correctly mapping GS senderId
      senderQualifier: firstInterchange.isa.senderidqualifier_5,
      receiverId: firstGroup.gs.receiveridcode_3, // Correctly mapping GS receiverId
      receiverQualifier: firstInterchange.isa.receiveridqualifier_7,
      poNumber: transaction.beg.purchaseordernumber_03,
      controlNumber: transaction.st.transactionsetcontrolnumber_02,
      date: transaction.beg.date_05
    },
    billTo: {
      name: billTo.n1?.name_02 || '',
      customerId: billTo.n1?.identificationcode_04 || ''
    },
    shipTo: {
      name: shipTo.n1?.name_02 || '',
      customerId: shipTo.n1?.identificationcode_04 || ''
    },
    items: items,
    totalItems: items.length
  }

  return purchaseOrder
}
