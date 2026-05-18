import { NextResponse } from 'next/server';

// Map of proper nouns to their Devanagari equivalents for correct Indian pronunciation
const PROPER_NOUN_MAP = {
  // Locations — Mumbai
  'Vile Parle': 'विले पार्ले',
  'Vile Parle East': 'विले पार्ले ईस्ट',
  'Vile Parle West': 'विले पार्ले वेस्ट',
  'Andheri': 'अंधेरी',
  'Andheri East': 'अंधेरी ईस्ट',
  'Andheri West': 'अंधेरी वेस्ट',
  'Juhu': 'जुहू',
  'Bandra': 'बांद्रा',
  'Kurla': 'कुर्ला',
  'Santacruz': 'सांताक्रुज',
  'Borivali': 'बोरीवली',
  'Kandivali': 'कांदिवली',
  'Malad': 'मलाड',
  'Goregaon': 'गोरेगाव',
  'Jogeshwari': 'जोगेश्वरी',
  'Ghatkopar': 'घाटकोपर',
  'Mulund': 'मुलुंड',
  'Thane': 'ठाणे',
  'Powai': 'पवई',
  'Chembur': 'चेंबूर',
  'Dadar': 'दादर',
  'Worli': 'वर्ली',
  'Parel': 'परेल',
  'Lower Parel': 'लोअर परेल',
  'Wadala': 'वडाला',
  'Dharavi': 'धारावी',
  'Sion': 'सायन',
  'Matunga': 'माटुंगा',
  'Mahim': 'माहीम',
  'Khar': 'खार',
  'Irla': 'इर्ला',
  'DN Nagar': 'डीएन नगर',
  'Versova': 'वर्सोवा',
  'Oshiwara': 'ओशिवारा',
  'Lokhandwala': 'लोखंडवाला',
  'Chakala': 'चकाला',
  'Marol': 'मरोल',
  'Sahar': 'सहार',
  'MIDC': 'एमआईडीसी',
  'NMIMS': 'एनएमआईएमएस',
  'JVLR': 'जेवीएलआर',
  'SV Road': 'एसवी रोड',
  'WEH': 'वेस्टर्न एक्सप्रेस हाइवे',
  'Western Express Highway': 'वेस्टर्न एक्सप्रेस हाइवे',
  'Eastern Express Highway': 'ईस्टर्न एक्सप्रेस हाइवे',
  'Prem Nagar': 'प्रेम नगर',
  'Gundabali': 'गुंडाबाली',

  // Developer / Brand names
  'Chandak': 'चांदक',
  'Chandak Group': 'चांदक ग्रुप',

  // Project names
  'Greenairy': 'ग्रीनएरी',
  'Chandak Greenairy': 'चांदक ग्रीनएरी',
  'Vansham': 'वंशम',
  'Chandak Vansham': 'चांदक वंशम',
  'Highscape': 'हाईस्केप',
  'Chandak Highscape': 'चांदक हाईस्केप',
  'Sarvam': 'सर्वम',
  'Chandak Sarvam': 'चांदक सर्वम',

  // Common real estate terms pronounced incorrectly
  'RERA': 'रेरा',
  'OC': 'ओसी',
  'CC': 'सीसी',
  'IOD': 'आईओडी',
  'BHK': 'बीएचके',
  'SRA': 'एसआरए',
  'MHADA': 'म्हाडा',
  'MMRDA': 'एमएमआरडीए',
  'MCGM': 'एमसीजीएम',
};

// Replace proper nouns with Devanagari — longest match first to avoid partial replacements
function replaceProperNouns(text) {
  // Sort by length descending so "Chandak Greenairy" matches before "Chandak" or "Greenairy"
  const sortedEntries = Object.entries(PROPER_NOUN_MAP).sort(
    (a, b) => b[0].length - a[0].length
  );

  let result = text;
  for (const [english, devanagari] of sortedEntries) {
    // Case-insensitive whole-word match
    const regex = new RegExp(`\\b${english.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    result = result.replace(regex, devanagari);
  }
  return result;
}

export async function POST(request) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'Missing or empty text' }, { status: 400 });
    }

    const apiKey = process.env.SARVAM_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'SARVAM_API_KEY not configured' }, { status: 500 });
    }

    // Replace proper nouns with Devanagari before sending to Sarvam
    const processedText = replaceProperNouns(text.trim());

    const sarvamResponse = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'API-Subscription-Key': apiKey,
      },
      body: JSON.stringify({
        text: processedText,
        target_language_code: 'en-IN',
        speaker: 'shubh',
        model: 'bulbul:v3',
        sample_rate: 22050,
      }),
    });

    if (!sarvamResponse.ok) {
      const errText = await sarvamResponse.text();
      console.error('[Sarvam TTS] API error:', sarvamResponse.status, errText);
      return NextResponse.json(
        { error: `Sarvam TTS failed: ${sarvamResponse.status}` },
        { status: 502 }
      );
    }

    const data = await sarvamResponse.json();

    const base64Audio = data?.audios?.[0];
    if (!base64Audio) {
      console.error('[Sarvam TTS] No audio in response:', JSON.stringify(data));
      return NextResponse.json({ error: 'No audio returned from Sarvam' }, { status: 502 });
    }

    return NextResponse.json({ audio: base64Audio });
  } catch (err) {
    console.error('[Sarvam TTS] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}