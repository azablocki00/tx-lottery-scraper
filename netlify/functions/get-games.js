const fetch = require('node-fetch');
const cheerio = require('cheerio');

const BASE_URL = 'https://www.texaslottery.com';
const ALL_GAMES_URL = `${BASE_URL}/export/sites/lottery/Games/Scratch_Offs/all.html`;

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    const response = await fetch(ALL_GAMES_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch game list: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const games = [];
    const seenGameNumbers = new Set();

    // Find all table rows
    // Each game has multiple rows (one for game info, others for prize tiers)
    // We only want rows where the first column has a link to the game detail page
    $('table tr').each((i, row) => {
      const cells = $(row).find('td');
      
      // Skip if not enough columns
      if (cells.length < 5) return;

      // Check if first cell has a link (this identifies a game row vs prize tier row)
      const gameNumberCell = $(cells[0]);
      const link = gameNumberCell.find('a');
      const href = link.attr('href');
      
      if (!href || !href.includes('details.html')) return;

      const gameNumber = link.text().trim();
      
      // Skip duplicates
      if (seenGameNumbers.has(gameNumber)) return;
      seenGameNumbers.add(gameNumber);

      // Build absolute URL for detail page
      const detailUrl = href.startsWith('http')
        ? href
        : `${BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`;

      // Column order: Game#(0), Start Date(1), Ticket Price(2), Empty(3), Game Name(4)
      const startDate = $(cells[1]).text().trim();
      const ticketPriceRaw = $(cells[2]).text().trim();
      const gameName = $(cells[4]).text().trim();
      const ticketPrice = parseFloat(ticketPriceRaw.replace(/[^0-9.]/g, '')) || 0;

      // Validate we have actual data
      if (gameNumber && gameName && gameName.length > 0 && gameName !== '*') {
        games.push({
          gameNumber,
          gameName,
          startDate,
          ticketPrice,
          detailUrl,
        });
      }
    });

    console.log(`Successfully scraped ${games.length} games`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ games, total: games.length }),
    };
  } catch (error) {
    console.error('get-games error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};