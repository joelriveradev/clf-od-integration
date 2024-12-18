import { supabase } from '@/lib/supabase/client.ts'
import { PurchaseOrder } from '@/types.ts'
import { Order } from '@/lib/supabase/types/tables.ts'

export async function saveOrder(po: PurchaseOrder) {
  const customer_id = po.billTo.customerId

  // Only pass in the status, details, and customer_id
  // Supabase will default the other fields

  const order: Pick<Order, 'status' | 'details' | 'customer_id'> = {
    customer_id,
    status: 'PENDING',
    details: JSON.stringify(po)
  }

  const { data: orderResult, error } = await supabase
    .from('orders')
    .insert(order)
    .eq('customer_id', customer_id)
    .select()
    .single()

  if (error) {
    console.error('Error saving order:', error)
    return
  }

  return orderResult
}

export async function saveFile(file: Blob, name: string, folder: string) {
  const { data: fileResult, error: fileError } = await supabase.storage
    .from('edi_files')
    .upload(`/public/${folder}/${name}.edi`, file)

  if (fileError) {
    console.error('Error uploading file:', fileError)
    return
  }

  return fileResult
}
