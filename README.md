# Valepic

Valepic is a minimal kid-facing app that turns a word like `lion`, `castle`, or `rocket ship` into a printable coloring page. It can also add simple color-by-number labels by finding enclosed white regions in the generated line art and placing numbers inside them.

## What it does

- Accepts a short subject name from the browser.
- Uses a local demo generator for testing and can call a backend AI provider for real prompt-based generation.
- Overlays numbered labels onto enclosed regions on the client side.
- Shows a matching palette legend and supports printing or downloading the result.

## Run it

1. Start the app:

```powershell
npm start
```

2. Open `http://localhost:3000`.

## Real prompt generation

`Local demo` is only for exercising the UI. For real arbitrary-word generation, use `Backend AI` in the UI and configure the server with one of these providers.

### Hugging Face

```powershell
$env:IMAGE_PROVIDER="huggingface"
$env:HF_TOKEN="your_token_here"
$env:HF_MODEL="black-forest-labs/FLUX.1-schnell"
npm start
```

### Pollinations

```powershell
$env:IMAGE_PROVIDER="pollinations"
npm start
```

Pollinations may still reject requests with `401` depending on its current anonymous access rules.

## Notes

- The numbered overlay is heuristic. It works best when the generated page has bold enclosed regions and minimal tiny detail.
- If the image comes back too busy, use a simpler subject or generate again.
- A reliable production setup needs a real backend image provider.
- Browser-only anonymous providers are not stable enough to treat as guaranteed.

## Relevant docs

- Hugging Face inference docs: https://huggingface.co/docs/api-inference/en/tasks/text-to-image
- Pollinations status and anonymous access notes: https://auth.pollinations.ai/
