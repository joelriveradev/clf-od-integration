import type { PurchaseOrder, EDISegment } from './types.ts'

export class OrderDogParser {
  constructor(
    private readonly SEGMENT_TERMINATOR = '~',
    private readonly ELEMENT_SEPARATOR = '*'
  ) {}

  async parseEDI(content: string): Promise<PurchaseOrder> {
    if (!content || typeof content !== 'string') {
      throw new Error('Invalid EDI content provided.')
    }

    const segments = this.parseSegments(content)

    // Validate segment sequence
    this.validateSegments(segments)

    const po: PurchaseOrder = {
      header: { senderId: '', receiverId: '', poNumber: '', date: '' },
      billTo: { name: '', accountNumber: '' },
      shipTo: { name: '', accountNumber: '' },
      items: [],
      totalItems: 0,
    }

    for (const segment of segments) {
      switch (segment.tag) {
        case 'ISA': {
          po.header.senderId = segment.elements[5]?.trim()
          po.header.receiverId = segment.elements[7]?.trim()
          break
        }
        case 'BEG': {
          po.header.poNumber = segment.elements[2]
          po.header.date = segment.elements[4]
          if (!/^\d{8}$/.test(po.header.date)) {
            throw new Error(`Invalid date format: ${po.header.date}`)
          }
          break
        }
        case 'N1': {
          const qualifier = segment.elements[0]
          if (qualifier === 'BT') {
            po.billTo.name = segment.elements[1]
            po.billTo.accountNumber = segment.elements[3]
          } else if (qualifier === 'ST') {
            po.shipTo.name = segment.elements[1]
            po.shipTo.accountNumber = segment.elements[3]
          }
          break
        }
        case 'PO1': {
          po.items.push({
            lineNumber: segment.elements[0],
            quantity: parseFloat(segment.elements[1]),
            uom: segment.elements[2],
            price: parseFloat(segment.elements[3]),
            productId: segment.elements[6],
          })
          break
        }
        case 'CTT': {
          po.totalItems = parseInt(segment.elements[0])
          break
        }
      }
    }

    return po
  }

  private parseSegments(ediContent: string): EDISegment[] {
    const lines = ediContent
      .split(/[\r\n]+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    return lines.map((line) => {
      const cleaned = line.endsWith(this.SEGMENT_TERMINATOR)
        ? line.slice(0, -1)
        : line
      const elements = cleaned.split(this.ELEMENT_SEPARATOR)
      return { tag: elements[0], elements: elements.slice(1) }
    })
  }

  private validateSegments(segments: EDISegment[]): boolean {
    // Required segment order per OrderDog guide
    const requiredSequence = [
      'ISA',
      'GS',
      'ST',
      'BEG',
      'REF',
      'N1',
      'N1',
      'PO1',
      'CTT',
      'SE',
      'GE',
      'IEA',
    ]

    // disable validaiton checks for now
    // Check first segments match exactly
    // for (let i = 0; i < 7; i++) {
    //   if (segments[i]?.tag !== requiredSequence[i]) {
    //     throw new Error(
    //       `Invalid segment sequence. Expected ${requiredSequence[i]} but got ${segments[i]?.tag}`
    //     )
    //   }
    // }

    // Check last segments match exactly
    // const lastSegments = segments.slice(-4)
    // const requiredLast = requiredSequence.slice(-4)
    // for (let i = 0; i < 4; i++) {
    //   if (lastSegments[i]?.tag !== requiredLast[i]) {
    //     throw new Error(
    //       `Invalid ending sequence. Expected ${requiredLast[i]} but got ${lastSegments[i]?.tag}`
    //     )
    //   }
    // }

    return true
  }
}
