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

    // The all.html table has columns: Game #, Game Name, Start Date, Ticket Price
    // The game number cell contains a link to the detail page
    $('table tbody tr').each((i, row) => {
      const cells = $(row).find('td');
      if (cells.length < 4) return;

      const gameNumberCell = $(cells[0]);
      const link = gameNumberCell.find('a');
      const href = link.attr('href');
      const gameNumber = link.text().trim() || gameNumberCell.text().trim();

      if (!gameNumber || !href) return;

      // Build absolute URL for detail page
      const detailUrl = href.startsWith('http')
        ? href
        : `${BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`;

      const gameName = $(cells[1]).text().trim();
      const startDate = $(cells[2]).text().trim();
      const ticketPriceRaw = $(cells[3]).text().trim();
      const ticketPrice = parseFloat(ticketPriceRaw.replace(/[^0-9.]/g, '')) || 0;

      if (gameNumber && gameName) {
        games.push({
          gameNumber,
          gameName,
          startDate,
          ticketPrice,
          detailUrl,
        });
      }
    });

    if (games.length === 0) {
      // Fallback: try alternate table selectors
      console.log('Primary selector found 0 games, trying fallback...');
      $('tr').each((i, row) => {
        const cells = $(row).find('td');
        if (cells.length < 4) return;
        const link = $(cells[0]).find('a');
        const href = link.attr('href');
        if (!href || !href.includes('gamedetail')) return;

        const gameNumber = link.text().trim();
        const detailUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
        const gameName = $(cells[1]).text().trim();
        const startDate = $(cells[2]).text().trim();
        const ticketPrice = parseFloat($(cells[3]).text().replace(/[^0-9.]/g, '')) || 0;

        if (gameNumber) {
          games.push({ gameNumber, gameName, startDate, ticketPrice, detailUrl });
        }
      });
    }

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