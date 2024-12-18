import 'jsr:@std/dotenv/load'

import {
  type X12Interchange,
  type OperationResult
} from './lib/edination/api/api.ts'
import { normalize } from './normalize.ts'

export function useEDIAction() {
  const key = Deno.env.get('EDINATION_API_KEY')!

  return {
    // Parses an EDI file into JSON, and returns a
    // normalized, structured PurchaseOrder object
    parse: async (content: string) => {
      const blob: Blob = new Blob([content], {
        type: 'text/plain'
      })

      const res = await fetch(`https://api.edination.com/v2/x12/read`, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': key,
          'Content-Type': 'application/json'
        },
        body: blob
      })

      const json: Array<X12Interchange> = await res.json()

      const { Result } = json[0]

      if (Result && Result.Status === 'error') {
        if (Result.Details?.length) {
          Result.Details.forEach(({ Message }) => {
            console.error('Error parsing EDI file', Message)
          })
        }
      }

      return {
        po: await normalize(json),
        json
      }
    },

    // Validates an EDI file
    validate: async (interchange: X12Interchange) => {
      const res = await fetch(`https://api.edination.com/v2/x12/validate`, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': key,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(interchange)
      })

      const result: OperationResult = await res.json()

      if (result && result?.Status === 'success') {
        return {
          valid: true
        }
      }
      return {
        valid: false,
        ...result
      }
    },

    // Creates a 997 acknowledgment EDI file
    createAck: async (interchange: X12Interchange) => {
      // const post = x12AckPost(interchange)
      // // Todo: figure out how to create a 997 acknowledgment
      // // with errors if 850 is not valid

      const resack = await fetch(`https://api.edination.com/v2/x12/ack`, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': key,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(interchange)
      })

      const ackjson: Array<X12Interchange> = await resack.json()

      // console.log(ackjson)

      const reswrite = await fetch(`https://api.edination.com/v2/x12/write`, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': key,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ackjson[0])
      })

      return new Uint8Array(await reswrite.arrayBuffer())
    }
  }
}
