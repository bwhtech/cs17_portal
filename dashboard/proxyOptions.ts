let webserver_port = 8000;
try {
  const common_site_config = require('../../../sites/common_site_config.json');
  webserver_port = common_site_config.webserver_port;
} catch {
  // Not running inside a bench — proxy not needed
}

export default {
  '^/(app|api|assets|files|private)': {
    target: `http://127.0.0.1:${webserver_port}`,
    ws: true,
    router: function(req: { headers: { host: string } }) {
      const site_name = req.headers.host.split(':')[0];
      return `http://${site_name}:${webserver_port}`;
    }
  }
};