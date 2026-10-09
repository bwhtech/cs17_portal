### CS17 Portal

Portal for CS17 Students

### Installation

You can install this app using the [bench](https://github.com/frappe/bench) CLI:

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app $URL_OF_THIS_REPO --branch develop
bench install-app cs17_portal
```

### Dashboard

The student and faculty dashboard is a Vue 3 app in `dashboard/`, built with [frappe-ui](https://github.com/frappe/frappe-ui). It is served at `/dashboard`.

```bash
cd apps/cs17_portal/dashboard
yarn install
yarn dev        # dev server; API calls are proxied to the bench on port 8000
yarn build      # writes cs17_portal/public/dashboard and cs17_portal/www/dashboard.html
yarn typecheck
yarn lint
```

`yarn dev` needs `developer_mode` on the site, since the dev server loads its boot data over the API. The build output is not committed.

End to end tests are in `e2e/` and run with Playwright from the app root. Point them at your site:

```bash
SITE_HOST=cs17.localhost:8000 yarn test:e2e
```

[docs/dev-site.md](docs/dev-site.md) covers setting up a local site and the demo data.

### Contributing

This app uses `pre-commit` for code formatting and linting. Please [install pre-commit](https://pre-commit.com/#installation) and enable it for this repository:

```bash
cd apps/cs17_portal
pre-commit install
```

Pre-commit is configured to use the following tools for checking and formatting your code:

- ruff
- eslint
- prettier
- pyupgrade
### CI

This app can use GitHub Actions for CI. The following workflows are configured:

- CI: Installs this app and runs unit tests on every push to `develop` branch.
- Linters: Runs [Frappe Semgrep Rules](https://github.com/frappe/semgrep-rules) and [pip-audit](https://pypi.org/project/pip-audit/) on every pull request.


### License

mit
