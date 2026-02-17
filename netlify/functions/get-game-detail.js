const fetch = require('node-fetch');
const cheerio = require('cheerio');

const BASE_URL = 'https://www.texaslottery.com';

// Parse dollar amounts like "$1,000,000" → 1000000
function parseDollar(str) {
  if (!str) return 0;
  return parseFloat(str.replace(/[^0-9.]/g, '')) || 0;
}

// Parse number strings like "1,234,567" → 1234567
function parseNum(str) {
  if (!str) return 0;
  return parseInt(str.replace(/[^0-9]/g, ''), 10) || 0;
}

// Parse odds like "1 in 3.45" → "1 in 3.45"
function parseOdds(str) {
  if (!str) return 'N/A';
  const match = str.match(/1\s+in\s+[\d,.]+/i);
  return match ? match[0].trim() : str.trim();
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  const { url } = event.queryStringParameters || {};
  if (!url) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing url parameter' }) };
  }

  const detailUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;

  try {
    const response = await fetch(detailUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch detail page: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // --- Parse Game Info Fields ---
    let packSize = 0;
    let guaranteedPrizeAmount = 0;
    let totalTickets = 0;
    let overallOdds = 'N/A';

    // Get full text to search for specific patterns
    const fullText = $('body').text();

    // Extract Total Tickets from "There are approximately X* tickets."
    const ticketMatch = fullText.match(/There are approximately\s+([\d,]+)\*?\s+tickets/i);
    if (ticketMatch) {
      totalTickets = parseNum(ticketMatch[1]);
    }

    // Method 1: Look for table rows or labeled elements
    $('table tr, dl, .game-detail, p').each((i, el) => {
      const text = $(el).text();
      const lower = text.toLowerCase();

      if (lower.includes('pack size') && packSize === 0) {
        const match = text.match(/[\d,]+/);
        if (match) packSize = parseNum(match[0]);
      }
      if ((lower.includes('guaranteed') || lower.includes('guaranteed total prize')) && guaranteedPrizeAmount === 0) {
        const match = text.match(/\$[\d,]+/);
        if (match) guaranteedPrizeAmount = parseDollar(match[0]);
      }
      if (lower.includes('overall odds') && overallOdds === 'N/A') {
        overallOdds = parseOdds(text);
      }
    });

    // Method 2: Scan all text nodes for key-value patterns if Method 1 missed anything
    if (packSize === 0 || totalTickets === 0) {
      const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean);

      for (let j = 0; j < lines.length; j++) {
        const lower = lines[j].toLowerCase();
        if (lower.includes('pack size') && packSize === 0) {
          // Value may be on same line or next line
          const sameLineMatch = lines[j].match(/pack size[^\d]*([\d,]+)/i);
          if (sameLineMatch) packSize = parseNum(sameLineMatch[1]);
          else if (lines[j + 1]) packSize = parseNum(lines[j + 1]);
        }
        if (lower.includes('guaranteed') && guaranteedPrizeAmount === 0) {
          const match = lines[j].match(/\$[\d,]+/);
          if (match) guaranteedPrizeAmount = parseDollar(match[0]);
        }
        if (lower.includes('overall odds') && overallOdds === 'N/A') {
          overallOdds = parseOdds(lines[j]);
          if (overallOdds === lines[j].trim() && lines[j + 1]) {
            overallOdds = parseOdds(lines[j + 1]);
          }
        }
      }
    }

    // --- Parse Prizes Printed Table ---
    // Columns: Prize Amount | No. In Game | No. Prizes Claimed | No. Prizes Remaining
    let topPrize = 0;
    let topPrizeInGame = 0;
    let topPrizeClaimed = 0;
    let prizesFound = false;

    // Find the prizes table — look for a table containing "Prize Amount" or "Prizes Printed"
    $('table').each((i, table) => {
      const tableText = $(table).text().toLowerCase();
      if (
        !tableText.includes('prize') ||
        (!tableText.includes('in game') && !tableText.includes('claimed'))
      ) {
        return; // not the prizes table
      }

      // Determine column indices from header row
      let prizeAmountCol = 0;
      let inGameCol = 1;
      let claimedCol = 2;

      const headerRow = $(table).find('thead tr, tr').first();
      headerRow.find('th, td').each((j, cell) => {
        const cellText = $(cell).text().toLowerCase();
        if (cellText.includes('prize') && cellText.includes('amount')) prizeAmountCol = j;
        else if (cellText.includes('in game')) inGameCol = j;
        else if (cellText.includes('claimed')) claimedCol = j;
      });

      // Parse data rows
      $(table).find('tbody tr, tr').each((j, row) => {
        const cells = $(row).find('td');
        if (cells.length < 3) return;

        const prizeText = $(cells[prizeAmountCol]).text().trim();
        const inGameText = $(cells[inGameCol]).text().trim();
        const claimedText = $(cells[claimedCol]).text().trim();

        const prizeVal = parseDollar(prizeText);
        const inGameVal = parseNum(inGameText);
        const claimedVal = parseNum(claimedText);

        if (prizeVal > 0 && (inGameVal > 0 || claimedVal >= 0)) {
          prizesFound = true;
          if (prizeVal > topPrize) {
            topPrize = prizeVal;
            topPrizeInGame = inGameVal;
            topPrizeClaimed = claimedVal;
          }
        }
      });
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        packSize,
        guaranteedPrizeAmount,
        totalTickets,
        overallOdds,
        topPrize,
        topPrizeInGame,
        topPrizeClaimed,
        prizesFound,
      }),
    };
  } catch (error) {
    console.error('get-game-detail error:', error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
