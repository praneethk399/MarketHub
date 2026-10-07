#!/bin/bash
set -euo pipefail
cd /c/Users/PRANEETH/Downloads/markethub

echo "=== Cleaning up dead landing-pages files ==="
rm -f components/landing-pages/BestsellersBookShowcase.tsx \
      components/landing-pages/CompleteShelfLandingPage.tsx \
      components/landing-pages/LandingPageFrame.tsx \
      components/landing-pages/LazyMount.tsx \
      components/landing-pages/pageTypography.ts \
      components/landing-pages/pageRecipes.ts \
      components/working-volumes-section.tsx \
      components/field-manuals-section.tsx

echo "=== Removing fonts/ (no longer needed — threeui.css import removed from layout.tsx) ==="
rm -rf components/landing-pages/fonts

echo "=== Removing threeui.css import from layout.tsx ==="
if grep -q "import '@/components/landing-pages/threeui.css'" app/layout.tsx; then
  sed -i '/import '\''@\/components\/landing-pages\/threeui.css'\''/d' app/layout.tsx
  sed -i 's/import '\''.\/globals.css'\''/import '"'"'./globals.css'"'"'/' app/layout.tsx
  echo "Removed threeui.css import from layout.tsx"
else
  echo "Threeui.css import already absent from layout.tsx"
fi

echo "=== Now layout.tsx should import only globals.css ==="
grep -n "import" app/layout.tsx

echo "=== Done cleanup ==="
git status --short
