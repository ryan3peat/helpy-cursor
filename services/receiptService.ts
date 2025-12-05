// services/receiptService.ts
// Handles receipt storage and database operations

import { supabase } from './supabase';
import { ParsedReceipt, processReceipt } from './visionService';

interface ReceiptRecord {
  id: string;
  householdId: string;
  expenseId: string | null;
  imagePath: string;
  imageUrl: string;
  ocrRawText: string;
  ocrConfidence: number;
  detectedTotal: number;
  detectedMerchant: string;
  detectedDate: string;
  detectedItems: Array<{ name: string; price: number }>;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
}

/**
 * Upload receipt image to Supabase Storage
 * Why: Images need permanent storage, not just base64 in memory
 */
export async function uploadReceiptImage(
  householdId: string,
  base64Data: string,
  fileType: string = 'jpeg'
): Promise<{ path: string; url: string }> {
  // Generate unique filename
  const timestamp = Date.now();
  const filename = `${timestamp}.${fileType}`;
  const filePath = `${householdId}/${filename}`;

  // Convert base64 to Blob
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: `image/${fileType}` });

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from('receipts')
    .upload(filePath, blob, {
      contentType: `image/${fileType}`,
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload receipt: ${error.message}`);
  }

  // Get signed URL (valid for 1 year)
  const { data: urlData } = await supabase.storage
    .from('receipts')
    .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year

  return {
    path: data.path,
    url: urlData?.signedUrl || '',
  };
}

/**
 * Create receipt record in database
 */
export async function createReceiptRecord(
  householdId: string,
  imagePath: string,
  imageUrl: string
): Promise<string> {
  const { data, error } = await supabase
    .from('receipts')
    .insert({
      household_id: householdId,
      image_path: imagePath,
      image_url: imageUrl,
      processing_status: 'pending',
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create receipt record: ${error.message}`);
  }

  return data.id;
}

/**
 * Update receipt with OCR results
 */
export async function updateReceiptWithOCR(
  receiptId: string,
  parsed: ParsedReceipt
): Promise<void> {
  const { error } = await supabase
    .from('receipts')
    .update({
      ocr_raw_text: parsed.rawText,
      ocr_confidence: parsed.confidence,
      detected_total: parsed.total,
      detected_merchant: parsed.merchant,
      detected_date: parsed.date,
      detected_items: parsed.lineItems,
      processing_status: 'completed',
      processed_at: new Date().toISOString(),
    })
    .eq('id', receiptId);

  if (error) {
    throw new Error(`Failed to update receipt: ${error.message}`);
  }
}

/**
 * Mark receipt as failed
 */
export async function markReceiptFailed(
  receiptId: string,
  errorMessage: string
): Promise<void> {
  await supabase
    .from('receipts')
    .update({
      processing_status: 'failed',
      error_message: errorMessage,
    })
    .eq('id', receiptId);
}

/**
 * Link receipt to expense
 * Also updates the expenses.receipt_url field for backward compatibility
 */
export async function linkReceiptToExpense(
  receiptId: string,
  expenseId: string
): Promise<void> {
  // First, get the receipt's image_url
  const { data: receiptData, error: fetchError } = await supabase
    .from('receipts')
    .select('image_url')
    .eq('id', receiptId)
    .single();

  if (fetchError) {
    console.error('[ReceiptService] Failed to fetch receipt for linking:', {
      receiptId,
      error: fetchError.message,
    });
    throw new Error(`Failed to fetch receipt: ${fetchError.message}`);
  }

  // Update the receipt with the expense_id
  const { error: linkError } = await supabase
    .from('receipts')
    .update({ expense_id: expenseId })
    .eq('id', receiptId);

  if (linkError) {
    console.error('[ReceiptService] Failed to link receipt to expense:', {
      receiptId,
      expenseId,
      error: linkError.message,
      details: linkError.details,
      hint: linkError.hint,
    });
    throw new Error(`Failed to link receipt to expense: ${linkError.message}`);
  }

  // Also update the expenses.receipt_url field for backward compatibility
  // This ensures the receipt is visible even if JOIN doesn't work
  if (receiptData?.image_url) {
    const { error: updateError } = await supabase
      .from('expenses')
      .update({ receipt_url: receiptData.image_url })
      .eq('id', expenseId);

    if (updateError) {
      console.warn('[ReceiptService] Failed to update expenses.receipt_url (non-fatal):', {
        expenseId,
        error: updateError.message,
      });
      // Non-fatal: the receipt is linked, just the denormalized field isn't set
    } else {
      console.log('[ReceiptService] Successfully updated expenses.receipt_url for expense:', expenseId);
    }
  }
}

/**
 * Full pipeline: Upload, OCR, and return parsed data
 */
export async function processReceiptFull(
  householdId: string,
  base64Image: string,
  fileType: string = 'jpeg'
): Promise<{
  receiptId: string;
  imageUrl: string;
  parsed: ParsedReceipt;
}> {
  // 1. Upload image
  const { path, url } = await uploadReceiptImage(householdId, base64Image, fileType);

  // 2. Create receipt record (status: pending)
  const receiptId = await createReceiptRecord(householdId, path, url);

  try {
    // 3. Process with Vision API
    const parsed = await processReceipt(base64Image);

    // 4. Update receipt with results
    await updateReceiptWithOCR(receiptId, parsed);

    return { receiptId, imageUrl: url, parsed };
  } catch (error) {
    // Mark as failed if OCR fails
    await markReceiptFailed(receiptId, error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

export async function deleteReceiptByExpenseId(expenseId: string): Promise<void> {
  // Fetch receipts linked to the expense
  const { data, error } = await supabase
    .from('receipts')
    .select('id, image_path')
    .eq('expense_id', expenseId);

  if (error) {
    throw new Error(`Failed to fetch receipts for deletion: ${error.message}`);
  }
  if (!data || data.length === 0) return;

  // Remove storage objects
  const paths = data.map((r: { image_path: string }) => r.image_path).filter(Boolean);
  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage.from('receipts').remove(paths);
    if (storageError) {
      // Non-fatal: log but continue to delete DB rows
      console.warn('Storage remove warning:', storageError.message);
    }
  }

  // Remove DB rows
  const ids = data.map((r: { id: string }) => r.id);
  const { error: deleteError } = await supabase.from('receipts').delete().in('id', ids);
  if (deleteError) {
    throw new Error(`Failed to delete receipt rows: ${deleteError.message}`);
  }
}

/**
 * Unlink receipt(s) from an expense without deleting the receipt rows/images.
 * Use this if you want to keep the receipt but remove its association.
 */
export async function unlinkReceiptFromExpenseByExpenseId(expenseId: string): Promise<void> {
  const { error } = await supabase
    .from('receipts')
    .update({ expense_id: null })
    .eq('expense_id', expenseId);

  if (error) {
    throw new Error(`Failed to unlink receipt from expense: ${error.message}`);
  }
}
