# Images

Drop project stills and gallery photos here. Naming convention matches the
`TODO(IMAGE)` comments in `index.html`:

```
images/
├── work/
│   ├── 01.jpg     ← 1st credit, ~1600×1000 (16:10)
│   ├── 02.jpg     ← 2nd credit, ~1600×1000
│   ├── 03.jpg     ← 3rd credit, ~1600×1000
│   └── ...
├── about/
│   └── portrait.jpg   ← 1×1 or 4×5 portrait, ~1200×1500
├── reel/
│   └── poster.jpg     ← fallback image for the showreel frame
└── og/
    └── cover.jpg      ← 1200×630, used for Open Graph share image later
```

Then update the comment in `index.html` for each block from:

```html
<!-- TODO(IMAGE): drop image at assets/images/work/01.jpg -->
```

to something the browser can show:

```html
<img src="assets/images/work/01.jpg" alt="Shoot still from Trenque Lauquen" loading="lazy" />
```

**Tip:** keep JPGs under ~250KB each — use WebP if you're comfortable with
formats. The site is read-only; nothing breaks if you skip a file.
