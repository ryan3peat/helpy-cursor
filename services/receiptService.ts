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
 */
export async function linkReceiptToExpense(
  receiptId: string,
  expenseId: string
): Promise<void> {
  await supabase
    .from('receipts')
    .update({ expense_id: expenseId })
    .eq('id', receiptId);
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