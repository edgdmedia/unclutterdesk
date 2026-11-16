# Manual Test: Publish a Profile in 10 Minutes

**Purpose:** Verify that a new therapist can sign up, pick a template, pick a theme, and publish a profile in under 10 minutes.

**Owner:** Olalekan

**Last updated:** 2026-11-16

---

## Prerequisites

- [ ] Fresh browser session (no existing cookies or sessions)
- [ ] Valid email address that can receive mail
- [ ] Stopwatch or timer ready
- [ ] This document open for recording results

---

## Test Steps

### Step 1: Sign Up (Target: 2 minutes)

**Start timer:** ______ : ______

1. Navigate to `https://app.unclutterdesk.com/signup`
2. Fill in the sign-up form:
   - First name: ______
   - Last name: ______
   - Email: ______
   - Password: ______ (must meet policy: 8+ chars, uppercase, lowercase, number)
   - Handle: ______ (3-30 chars, lowercase letters/numbers/hyphens)
   - Kind: Select one (Counsellor / Psychotherapist / Psychologist / etc.)
3. Click "Create account"
4. Check email for 6-digit verification code
5. Enter the 6-digit code on the verification page
6. Click "Verify"

**Checkpoint:** You should be redirected to the profile editor.

**Time at checkpoint:** ______ : ______

**Issues:** 
- [ ] None
- [ ] Other: ______

---

### Step 2: Pick a Template (Target: 1 minute)

1. On the profile editor, locate the "Template" section
2. Review available templates:
   - [ ] Private practice counsellor
   - [ ] Private practice psychotherapist
   - [ ] Clinical psychologist
   - [ ] Other (list): ______
3. Select a template: ______
4. Verify that the template pre-fills relevant sections (headline, about, specialties)

**Checkpoint:** Template content is loaded into the editor.

**Time at checkpoint:** ______ : ______

**Issues:**
- [ ] None
- [ ] Template not applied
- [ ] Content not pre-filled
- [ ] Other: ______

---

### Step 3: Pick a Theme (Target: 1 minute)

1. Locate the "Theme" or "Appearance" section
2. Review available themes:
   - [ ] Calm (blue-white)
   - [ ] Warm (cream-clay)
   - [ ] Crisp (white-slate)
   - [ ] Earth (stone-olive)
   - [ ] Night (deep ink)
3. Select a theme: ______
4. Verify the preview updates to show the selected theme

**Checkpoint:** Theme is applied and visible in preview.

**Time at checkpoint:** ______ : ______

**Issues:**
- [ ] None
- [ ] Theme not applied
- [ ] Preview not updating
- [ ] Other: ______

---

### Step 4: Review and Edit (Target: 3 minutes)

1. Review the pre-filled content from the template
2. Edit as needed:
   - [ ] Headline: ______
   - [ ] About section: ______
   - [ ] Specialties: ______
   - [ ] Photo: [ ] Uploaded / [ ] Skipped
3. Verify all required fields are filled:
   - [ ] Name (auto-filled from sign-up)
   - [ ] Kind (auto-filled from sign-up)
   - [ ] Headline (≥10 chars)
   - [ ] About (≥150 chars)
   - [ ] Country: ______
   - [ ] At least 1 specialty

**Checkpoint:** All required fields are complete.

**Time at checkpoint:** ______ : ______

**Issues:**
- [ ] None
- [ ] Required field missing
- [ ] Validation error: ______
- [ ] Other: ______

---

### Step 5: Publish (Target: 1 minute)

1. Locate the "Publish" button
2. Click "Publish"
3. Wait for confirmation message
4. Verify the profile is now live

**Checkpoint:** Profile is published and accessible.

**Time at checkpoint:** ______ : ______

**Issues:**
- [ ] None
- [ ] Publish button not working
- [ ] No confirmation message
- [ ] Profile not accessible at `https://therapysts.com/{handle}`
- [ ] Other: ______

---

### Step 6: Verify Public Profile (Target: 2 minutes)

1. Open a new browser tab (incognito or different browser)
2. Navigate to `https://therapysts.com/{handle}` (replace with your handle)
3. Verify the profile displays correctly:
   - [ ] Name visible
   - [ ] Photo visible (if uploaded)
   - [ ] Headline visible
   - [ ] About section visible
   - [ ] Specialties visible
   - [ ] Theme applied correctly
   - [ ] Layout matches selection
4. Check for any broken elements or missing content

**Checkpoint:** Public profile is accessible and displays correctly.

**Time at checkpoint:** ______ : ______

**Issues:**
- [ ] None
- [ ] Profile not found (404)
- [ ] Content missing: ______
- [ ] Theme not applied
- [ ] Broken layout
- [ ] Other: ______

---

## Results

**Total time:** ______ minutes ______ seconds

**Pass/Fail:** [ ] PASS / [ ] FAIL

**Browser used:** ______

**Browser version:** ______

**Operating system:** ______

---

## Pass Criteria

The test **PASSES** if:

- [ ] Total time is ≤ 10 minutes (600 seconds)
- [ ] All 6 steps completed without critical errors
- [ ] Public profile is accessible and displays correctly
- [ ] No data loss or corruption
- [ ] All required fields validated correctly

The test **FAILS** if:

- [ ] Total time exceeds 10 minutes
- [ ] Any step cannot be completed
- [ ] Public profile is not accessible
- [ ] Critical validation errors prevent publishing
- [ ] Data loss or corruption occurs

---

## Notes

**What went well:**
- ______
- ______

**What could be improved:**
- ______
- ______

**Bugs found:**
- ______
- ______

**Suggestions:**
- ______
- ______

---

## Test Log

| Date | Tester | Time | Result | Browser | Notes |
|------|--------|------|--------|---------|-------|
| 2026-11-16 | Olalekan | TBD | TBD | TBD | Initial test |

---

## Appendix: Troubleshooting

### If verification code doesn't arrive:
- Check spam folder
- Wait up to 5 minutes
- Try resending the code
- Contact support if still not received

### If template doesn't apply:
- Refresh the page
- Try a different template
- Check browser console for errors

### If publish fails:
- Verify all required fields are filled
- Check for validation errors (red borders)
- Try saving as draft first, then publish
- Check browser console for errors

### If public profile shows 404:
- Wait 1-2 minutes (propagation delay)
- Verify the handle is correct
- Check that profile status is "PUBLISHED"
- Try hard refresh (Ctrl+Shift+R / Cmd+Shift+R)
