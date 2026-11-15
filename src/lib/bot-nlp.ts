import { ProductService, SupplierService, TransactionService, AuthService } from './db';
import { BotParseResult, BotConversationState, Product } from '@/types';

// In-memory conversation state per chat_id (untuk skenario Gambar 24: bot tanya balik supplier)
const conversationStates = new Map<string, BotConversationState>();

export function getConversationState(chatId: string): BotConversationState | undefined {
  return conversationStates.get(chatId);
}

export function setConversationState(chatId: string, state: BotConversationState): void {
  conversationStates.set(chatId, state);
}

export function clearConversationState(chatId: string): void {
  conversationStates.delete(chatId);
}

// Fallback guide text (sesuai Wireframe Gambar 28)
export const FALLBACK_MESSAGE = `Maaf, saya tidak mengenali pesan tersebut.

Berikut perintah yang tersedia:
1. Stok masuk — "masuk [jumlah] [produk] dari [supplier]"
2. Stok keluar — "keluar [jumlah] [produk]"
3. Cek stok — "stok [produk] berapa?"
4. Rekap harian — "rekap hari ini"`;

// ============================================================================
// INTENT PARSER & AI AGENT ENGINE (Mendukung Groq API Llama & Local Smart NLP)
// ============================================================================

export async function processBotMessage(
  messageText: string,
  chatId: string = '123456789'
): Promise<BotParseResult> {
  const cleanText = messageText.trim();
  if (!cleanText) {
    return { success: false, intent: 'unknown', replyText: FALLBACK_MESSAGE };
  }

  // 1. Cek apakah ada state percakapan yang tertunda (Menunggu nama supplier)
  const currentState = getConversationState(chatId);
  if (currentState && currentState.awaiting === 'supplier' && currentState.pending_action) {
    const supplierName = cleanText;
    const { product_name, qty, unit } = currentState.pending_action;

    // Bersihkan state setelah menerima jawaban
    clearConversationState(chatId);

    // Lanjutkan eksekusi stok masuk dengan supplier yang diberikan
    return await executeStokMasuk(product_name, qty, unit, supplierName);
  }

  // 2. Jika konfigurasi GROQ_API_KEY tersedia, gunakan AI Agent via Groq
  const groqApiKey = process.env.GROQ_API_KEY;
  if (groqApiKey && !groqApiKey.includes('your_groq_api_key')) {
    try {
      const groqResult = await parseWithGroq(cleanText, groqApiKey);
      if (groqResult) {
        return await executeIntent(groqResult, chatId, cleanText);
      }
    } catch (err) {
      console.warn('Groq API error, beralih ke Smart NLP Engine bawaan:', err);
    }
  }

  // 3. Smart NLP Engine bawaan (Bahasa Indonesia Sehari-hari)
  return await parseAndExecuteSmartNlp(cleanText, chatId);
}

// ============================================================================
// GROQ LLM (Llama) PARSER
// ============================================================================
async function parseWithGroq(text: string, apiKey: string) {
  const prompt = `Anda adalah parser AI untuk sistem pencatatan stok Warung Prapatan.
Analisis pesan bahasa Indonesia berikut dan kembalikan HANYA JSON murni (tanpa markdown, tanpa penjelasan):
{
  "intent": "stok_masuk" | "stok_keluar" | "cek_stok" | "rekap_harian" | "unknown",
  "product": string | null,
  "qty": number | null,
  "unit": "karton" | "pcs" | "bungkus" | "botol" | null,
  "supplier": string | null
}

Contoh:
"masuk 2 karton indomie dari unilever" -> {"intent":"stok_masuk","product":"indomie","qty":2,"unit":"karton","supplier":"unilever"}
"masuk 5 karton royco" -> {"intent":"stok_masuk","product":"royco","qty":5,"unit":"karton","supplier":null}
"keluar 3 pcs sabun lifebuoy" -> {"intent":"stok_keluar","product":"sabun lifebuoy","qty":3,"unit":"pcs","supplier":null}
"stok indomie berapa?" -> {"intent":"cek_stok","product":"indomie","qty":null,"unit":null,"supplier":null}
"rekap hari ini" -> {"intent":"rekap_harian","product":null,"qty":null,"unit":null,"supplier":null}
"halo apa kabar" -> {"intent":"unknown","product":null,"qty":null,"unit":null,"supplier":null}

Pesan Pengguna: "${text}"`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    throw new Error(`Groq HTTP ${response.status}`);
  }

  const json = await response.json();
  const rawContent = json.choices?.[0]?.message?.content;
  if (!rawContent) return null;

  return JSON.parse(rawContent);
}

async function executeIntent(parsed: any, chatId: string, originalText: string): Promise<BotParseResult> {
  const intent = parsed.intent;

  if (intent === 'stok_masuk') {
    const prodName = parsed.product || '';
    const qty = Number(parsed.qty) || 1;
    const unit = parsed.unit || 'pcs';
    const supplier = parsed.supplier;

    // Sesuai SRS F3 & Gambar 24: Apabila supplier tidak disebutkan, bot tanya balik
    if (!supplier || supplier.trim() === '') {
      setConversationState(chatId, {
        chat_id: chatId,
        awaiting: 'supplier',
        pending_action: {
          product_name: prodName,
          qty,
          unit,
          original_text: originalText
        },
        last_updated: Date.now()
      });
      return {
        success: true,
        intent: 'tanya_supplier',
        replyText: 'Dari supplier mana?'
      };
    }

    return await executeStokMasuk(prodName, qty, unit, supplier);
  }

  if (intent === 'stok_keluar') {
    const prodName = parsed.product || '';
    const qty = Number(parsed.qty) || 1;
    const unit = parsed.unit || 'pcs';
    return await executeStokKeluar(prodName, qty, unit);
  }

  if (intent === 'cek_stok') {
    return await executeCekStok(parsed.product || '');
  }

  if (intent === 'rekap_harian') {
    return await executeRekapHarian();
  }

  return {
    success: false,
    intent: 'unknown',
    replyText: FALLBACK_MESSAGE
  };
}

// ============================================================================
// SMART NLP ENGINE (BAHASA INDONESIA SEHARI-HARI)
// ============================================================================
async function parseAndExecuteSmartNlp(text: string, chatId: string): Promise<BotParseResult> {
  const lower = text.toLowerCase().trim();

  // 1. Rekap Harian (Gambar 27)
  if (lower.includes('rekap') || lower.includes('laporan hari ini') || lower.includes('ringkasan hari ini')) {
    return await executeRekapHarian();
  }

  // 2. Cek Stok (Gambar 26)
  // Contoh: "stok indomie berapa?", "cek stok royco", "berapa stok sabun"
  if (lower.startsWith('stok ') || lower.startsWith('cek stok') || lower.includes('berapa') || lower.startsWith('sisa ')) {
    let query = lower
      .replace(/^cek stok\s*/i, '')
      .replace(/^stok\s*/i, '')
      .replace(/^sisa\s*/i, '')
      .replace(/berapa\??/i, '')
      .replace(/ada berapa\??/i, '')
      .replace(/tinggal berapa\??/i, '')
      .trim();

    if (query) {
      return await executeCekStok(query);
    }
  }

  // 3. Stok Masuk (Gambar 23 & Gambar 24)
  // Contoh: "masuk 2 karton indomie dari unilever", "masuk 5 karton royco", "tambah 10 pcs sabun dari unilever"
  if (lower.startsWith('masuk ') || lower.startsWith('tambah ') || lower.startsWith('terima ')) {
    const stripped = lower.replace(/^(masuk|tambah|terima)\s+/i, '');

    // Cek apakah ada kata "dari [supplier]"
    const supplierMatch = stripped.match(/\s+dari\s+(.+)$/i);
    let supplierName: string | null = null;
    let mainPart = stripped;

    if (supplierMatch) {
      supplierName = supplierMatch[1].trim();
      mainPart = stripped.substring(0, supplierMatch.index).trim();
    }

    // Ekstrak jumlah dan satuan (misal: "2 karton indomie", "10 pcs sabun", "50 royco")
    const qtyMatch = mainPart.match(/^(\d+)\s*(karton|dus|box|kotak|pcs|bungkus|bks|botol|btl)?\s*(.+)$/i);

    if (qtyMatch) {
      const qty = parseInt(qtyMatch[1], 10);
      const unit = qtyMatch[2] ? qtyMatch[2].toLowerCase() : 'pcs';
      const productName = qtyMatch[3].trim();

      // Sesuai SRS F3 & Gambar 24: jika belum ada supplier, simpan state dan tanyakan
      if (!supplierName) {
        setConversationState(chatId, {
          chat_id: chatId,
          awaiting: 'supplier',
          pending_action: {
            product_name: productName,
            qty,
            unit,
            original_text: text
          },
          last_updated: Date.now()
        });
        return {
          success: true,
          intent: 'tanya_supplier',
          replyText: 'Dari supplier mana?'
        };
      }

      return await executeStokMasuk(productName, qty, unit, supplierName);
    }
  }

  // 4. Stok Keluar (Gambar 25)
  // Contoh: "keluar 3 pcs sabun lifebuoy", "jual 2 indomie goreng"
  if (lower.startsWith('keluar ') || lower.startsWith('jual ') || lower.startsWith('kurang ')) {
    const stripped = lower.replace(/^(keluar|jual|kurang)\s+/i, '');
    const qtyMatch = stripped.match(/^(\d+)\s*(karton|dus|box|kotak|pcs|bungkus|bks|botol|btl)?\s*(.+)$/i);

    if (qtyMatch) {
      const qty = parseInt(qtyMatch[1], 10);
      const unit = qtyMatch[2] ? qtyMatch[2].toLowerCase() : 'pcs';
      const productName = qtyMatch[3].trim();

      return await executeStokKeluar(productName, qty, unit);
    }
  }

  // 5. Fallback tidak dikenali (Gambar 28)
  return {
    success: false,
    intent: 'unknown',
    replyText: FALLBACK_MESSAGE
  };
}

// ============================================================================
// EKSEKUTOR AKSI CHATBOT
// ============================================================================

// Aksi 1: Eksekusi Stok Masuk (Gambar 3, 23, 24)
async function executeStokMasuk(
  productQuery: string,
  rawQty: number,
  unitStr: string,
  supplierName: string
): Promise<BotParseResult> {
  const product = await ProductService.findByName(productQuery);
  if (!product) {
    return {
      success: false,
      intent: 'stok_masuk',
      replyText: `Produk "${productQuery}" tidak ditemukan dalam daftar produk Warung Prapatan.`
    };
  }

  // Simpan stok dalam satuan utama produk; karton hanya dikonversi saat input.
  const isKarton = ['karton', 'dus', 'box', 'kotak'].includes(unitStr.toLowerCase());
  if (isKarton && !product.qty_per_karton) {
    return {
      success: false,
      intent: 'stok_masuk',
      replyText: `Produk ${product.name} tidak memiliki konversi karton. Gunakan satuan ${product.unit}.`
    };
  }
  const totalQty = isKarton ? rawQty * product.qty_per_karton! : rawQty;

  // Otomatis daftarkan supplier jika belum ada (Gambar 3 & SRS F2, F13)
  const supplier = await SupplierService.findOrCreate(supplierName);

  // Simpan transaksi stok masuk
  const note = isKarton ? `${rawQty} karton (${supplier.name})` : `Stok masuk (${supplier.name})`;
  await TransactionService.create({
    product_id: product.id,
    supplier_id: supplier.id,
    type: 'in',
    qty: totalQty,
    note
  });

  const updatedProduct = await ProductService.getById(product.id);
  const currentStock = updatedProduct ? updatedProduct.stock_current : product.stock_current + totalQty;

  // Format balasan sesuai Wireframe Gambar 23
  const kartonInfo = isKarton ? ` (${rawQty} karton)` : '';
  const replyText = `Stok masuk dicatat\nProduk: ${product.name}\nJumlah: +${totalQty} ${product.unit}${kartonInfo}\nSupplier: ${supplier.name}\nStok terkini: ${currentStock} ${product.unit}`;

  return {
    success: true,
    intent: 'stok_masuk',
    replyText,
    data: {
      product_name: product.name,
      product_id: product.id,
      qty: totalQty,
      supplier_name: supplier.name,
      supplier_id: supplier.id,
      stock_after: currentStock
    }
  };
}

// Aksi 2: Eksekusi Stok Keluar (Gambar 4, 25)
async function executeStokKeluar(
  productQuery: string,
  rawQty: number,
  unitStr: string
): Promise<BotParseResult> {
  const product = await ProductService.findByName(productQuery);
  if (!product) {
    return {
      success: false,
      intent: 'stok_keluar',
      replyText: `Produk "${productQuery}" tidak ditemukan.`
    };
  }

  const isKarton = ['karton', 'dus', 'box', 'kotak'].includes(unitStr.toLowerCase());
  if (isKarton && !product.qty_per_karton) {
    return {
      success: false,
      intent: 'stok_keluar',
      replyText: `Produk ${product.name} tidak memiliki konversi karton. Gunakan satuan ${product.unit}.`
    };
  }
  const totalQty = isKarton ? rawQty * product.qty_per_karton! : rawQty;

  // Validasi stok mencukupi (Gambar 4: Jika stok tidak mencukupi, kirim "Stok tidak mencukupi")
  if (product.stock_current < totalQty) {
    return {
      success: false,
      intent: 'stok_keluar',
      replyText: `Stok tidak mencukupi (sisa: ${product.stock_current} ${product.unit})`
    };
  }

  // Simpan transaksi stok keluar (supplier_id = null)
  const note = isKarton ? `${rawQty} karton keluar` : `Stok keluar`;
  await TransactionService.create({
    product_id: product.id,
    supplier_id: null,
    type: 'out',
    qty: totalQty,
    note
  });

  const updatedProduct = await ProductService.getById(product.id);
  const currentStock = updatedProduct ? updatedProduct.stock_current : product.stock_current - totalQty;

  // Format balasan sesuai Wireframe Gambar 25
  let replyText = `Stok keluar dicatat\nProduk: ${product.name}\nJumlah: -${totalQty} ${product.unit}${isKarton ? ` (${rawQty} karton)` : ''}\nStok terkini: ${currentStock} ${product.unit}`;

  if (currentStock <= product.stock_minimum) {
    replyText += ` ⚠️ (Perhatian: Stok menipis!)`;
  }

  return {
    success: true,
    intent: 'stok_keluar',
    replyText,
    data: {
      product_name: product.name,
      product_id: product.id,
      qty: totalQty,
      stock_after: currentStock
    }
  };
}

// Aksi 3: Cek Stok (Gambar 5, 26)
async function executeCekStok(productQuery: string): Promise<BotParseResult> {
  const product = await ProductService.findByName(productQuery);
  if (!product) {
    return {
      success: false,
      intent: 'cek_stok',
      replyText: `Produk "${productQuery}" tidak ditemukan.`
    };
  }

  const cartonCount = product.qty_per_karton
    ? Math.floor(product.stock_current / product.qty_per_karton)
    : 0;
  const cartonRemainder = product.qty_per_karton
    ? product.stock_current % product.qty_per_karton
    : 0;
  const cartonText = product.qty_per_karton
    ? cartonRemainder > 0
      ? ` (${cartonCount} karton + ${cartonRemainder} ${product.unit})`
      : ` (${cartonCount} karton)`
    : '';

  // Format balasan sesuai Wireframe Gambar 26
  const replyText = `Info stok\nProduk: ${product.name}\nStok saat ini: ${product.stock_current} ${product.unit}${cartonText}`;

  return {
    success: true,
    intent: 'cek_stok',
    replyText,
    data: {
      product_name: product.name,
      product_id: product.id,
      stock_after: product.stock_current
    }
  };
}

// Aksi 4: Rekap Harian (Gambar 6, 27)
async function executeRekapHarian(): Promise<BotParseResult> {
  const recap = await TransactionService.getDailyRecap();

  if (recap.totalTransactions === 0) {
    return {
      success: true,
      intent: 'rekap_harian',
      replyText: `Belum ada transaksi hari ini (${recap.dateFormatted}).`
    };
  }

  // Format balasan sesuai Wireframe Gambar 27
  let replyText = `Rekap transaksi — ${recap.dateFormatted}\n`;
  replyText += `Total transaksi: ${recap.totalTransactions}\n`;
  replyText += `Masuk: ${recap.masukCount} transaksi\n`;
  replyText += `Keluar: ${recap.keluarCount} transaksi\n`;
  replyText += `Rincian:\n`;
  replyText += recap.details.map(d => `• ${d}`).join('\n');

  return {
    success: true,
    intent: 'rekap_harian',
    replyText
  };
}
