# Ôn thi Môi giới BĐS

Static quiz site to study for the Vietnamese real-estate broker exam
(chứng chỉ hành nghề môi giới bất động sản).

## Banks included
- Cơ sở 300 / Chuyên môn 300 — official-style question bank
- Cơ sở 650 / Chuyên môn 650 — expanded bank (includes the 300 + extras)

## Modes
- **Học** — browse with reveal-answer
- **Luyện tập** — quick quiz with instant feedback
- **Thi thử** — 50 questions, 60 min timer, scored like the real exam (≥70 pass)
- **Ôn câu sai** — auto-review of questions you missed (saved in browser)

## Deploy to GitHub Pages

```bash
git init
git add .
git commit -m "BDS exam quiz"
git remote add origin https://github.com/<you>/bds-quiz.git
git push -u origin main
```

Then: repo **Settings → Pages → Source: Deploy from a branch → main → / (root) → Save**.
Site goes live at `https://<you>.github.io/bds-quiz/` in ~1 min.

No build step, no dependencies — works offline by just opening `index.html` too.

## Note
Answers are compiled from community banks + cross-checked vs two independent
sources (~95% confidence). Not an official Sở Xây dựng key.
