{
  "version": 2,
  "builds": [
    { "src": "index.html", "use": "@vercel/static" },
    { "src": "api/generate.js", "use": "@vercel/node" }
  ],
  "routes": [
    { "src": "/api/(.*)", "dest": "/api/generate.js" },
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
