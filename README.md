# CV Studio

[Tiếng Việt](README.vi.md)

CV Studio is a web app for creating and editing résumés in English or Vietnamese. Preview your layout as you edit and export an A4 PDF.

[Open CV Studio](https://cv-studio-phi.vercel.app/)

## Features

- Start from an industry-specific template or import a PDF.
- Switch layouts, preview page breaks, and export an A4 PDF.
- Save and compare versions, back up your data, and restore it later.
- Check your résumé against keywords in a job description and share a copy via a link.

## Run locally

Install Node.js 24 or later and npm. Run these commands from the project directory.

```sh
npm ci
npm test
npm run build
```

The build output is in `dist/`. Serve that directory with a static HTTP server. If you have Python 3, run `python -m http.server 8000 --bind 127.0.0.1 --directory dist` and open [localhost:8000](http://127.0.0.1:8000).

## Résumé data

Drafts and version history are stored in your browser. Use **Backup** to keep a copy or move your data to another browser. A share link contains the résumé data, so anyone with the link can open a copy.

## Contributing

Open an issue to report a bug or submit a pull request. If you attach a résumé to an import or export bug report, use fictional data.

## License

[MIT](LICENSE)
