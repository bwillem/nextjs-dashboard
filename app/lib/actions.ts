'use server'

import { sql } from '@vercel/postgres'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

// Behind the scenes, Server Actions create a POST API endpoint. This is why you don't need to create API endpoints manually when using Server Actions.

const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({
        invalid_type_error: 'Please select a customer',
    }),
    amount: z.coerce.number().gt(0, { message: 'Please enter an amount greater than $0' }),
    status: z.enum(['pending', 'paid'], {
        invalid_type_error: 'Please select an invoice status'
    }),
    date: z.string(),
})

const CreateInvoice = FormSchema.omit({ id: true, date: true })

export type State = {
    errors?: {
        customerId?: string[]
        amount?: string[]
        status?: string[]
    }
    message: string | null
}

export async function createInvoice(prevState: State, formData: FormData) {
    // validate using zod
    const validatedFields = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    })

    console.log(validatedFields)
    // if form validation fails return errors early
    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing fields'
        }
    }

    // prepare data for insertion into the database
    const { customerId, amount, status } = validatedFields.data
    const amountInCents = amount * 100
    const date = new Date().toISOString().split('T')[0]

    try {
        await sql`
        INSERT INTO invoices (customer_id, amount, status, date)
        VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `
    } catch {
        return {
            message: 'Databse error: Failed to create invoice'
        }
    }

    revalidatePath('/dashboard/invoices')
    redirect('/dashboard/invoices')
}

export async function updateInvoice(id: string, formData: FormData) {
    const { customerId, amount, status } = CreateInvoice.parse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    })

    const amountInCents = amount * 100

    try {
        await sql`
        UPDATE invoice
        SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
        WHERE id = ${id}
    `
    } catch {
        return {
            message: 'Databse error: Failed to create invoice'
        }
    }

    revalidatePath('/dashboard/invoices')
    redirect('/dashboard/invoices')
}

export async function deleteInvoice(id: string) {
    try {
        await sql`DELETE FROM invoices WHERE id = ${id}`
        revalidatePath('/dashboard/invoices')
        return { message: 'Deleted invoice' }
    } catch {
        return { message: 'Database error: failed to delete invoice' }
    }
}
