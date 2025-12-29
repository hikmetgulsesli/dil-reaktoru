const axios = require('axios');

async function test() {
  try {
    const response = await axios.get(
      'https://proxy.webshare.io/api/v2/proxy/list/',
      {
        headers: { 'Authorization': 'Token dc2cr9xf3xc8sy3yrjk1rnn41ocne4o0fes9uu4p' },
        params: { page: 1, page_size: 5, mode: 'rotating' }
      }
    );

    if (response.data.results && response.data.results.length > 0) {
      const p = response.data.results[0];
      console.log('Proxy found:', p.proxy_address, ':', p.port);
      console.log('Username:', p.username);
      console.log('Valid:', p.valid);
    } else {
      console.log('No proxies found');
    }
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

test();
