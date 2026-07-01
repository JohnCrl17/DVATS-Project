// ─── IMPROVED performOCR — Web Desk Version ──────────────────────────────────
// I-replace mo lang yung performOCR function sa iyong web desk JS file

async function performOCR(input) {
    const status = document.getElementById('ocr-status');
    if (!input.files || !input.files[0]) return;

    status.innerHTML = `
        <span style="color:#3b82f6; font-weight:700;">
            🔍 Scanning License... Please wait.
        </span>`;

    try {
        const imageFile = input.files[0];

        // ✅ Pre-process — grayscale + contrast boost
        const processedImage = await preprocessImage(imageFile);

        const result = await Tesseract.recognize(
            processedImage,
            'eng',
            {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        const pct = Math.round(m.progress * 100);
                        status.innerHTML = `
                            <span style="color:#3b82f6; font-weight:700;">
                                🔍 Processing... ${pct}%
                            </span>`;
                    }
                },
                tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-/.,: ',
                preserve_interword_spaces: '1',
            }
        );

        let rawText = result.data.text;
        console.log("RAW OCR TEXT:\n", rawText);

        // ✅ Parse using PHL license parser
        const parsed = parsePHLicense(rawText);
        console.log("PARSED:", parsed);

        let filledCount = 0;

        // Full Name
        if (parsed.fullname) {
            document.getElementById('fullname').value = parsed.fullname;
            filledCount++;
        }

        // License Number
        if (parsed.license_no) {
            document.getElementById('license_no').value = parsed.license_no;
            filledCount++;
        }

        // Date of Birth
        if (parsed.dob) {
            const dobInput = document.getElementById('dob');
            if (dobInput) {
                dobInput.type = 'date';
                dobInput.value = parsed.dob;
            }
            const ageInput = document.getElementById('age');
            if (ageInput) ageInput.value = calculateAge(parsed.dob);
            filledCount++;
        }

        // License Expiry
        if (parsed.expiry) {
            const expInput = document.getElementById('license_expiry');
            if (expInput) {
                expInput.type = 'date';
                expInput.value = parsed.expiry;
            }
            filledCount++;
        }

        // ✅ Gender — improved parsing
        if (parsed.gender) {
            const genderEl = document.getElementById('gender');
            if (genderEl) {
                genderEl.value = parsed.gender;
                filledCount++;
            }
        }

        // ✅ Email — kung may nakita
        if (parsed.email) {
            const emailEl = document.getElementById('email');
            if (emailEl) emailEl.value = parsed.email;
        }

        // ✅ Status feedback
        if (filledCount >= 3) {
            status.innerHTML = `<span style="color:#10b981; font-weight:700;">✅ Scan Complete! ${filledCount} fields filled.</span>`;
        } else if (filledCount > 0) {
            status.innerHTML = `<span style="color:#f59e0b; font-weight:700;">⚠️ Partial scan (${filledCount} fields). Please check and fill in the rest.</span>`;
        } else {
            status.innerHTML = `<span style="color:#ef4444; font-weight:700;">❌ Could not read license. Please fill manually.</span>`;
        }

    } catch (err) {
        console.error("OCR Error:", err);
        status.innerHTML = `<span style="color:#ef4444; font-weight:700;">❌ Scan failed. Please fill manually.</span>`;
    }
}

// ─── PRE-PROCESS IMAGE ────────────────────────────────────────────────────────
function preprocessImage(file) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width  = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                const gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
                const boosted = gray > 128 ? Math.min(255, gray * 1.2) : Math.max(0, gray * 0.8);
                data[i] = data[i+1] = data[i+2] = boosted;
            }
            ctx.putImageData(imageData, 0, 0);
            canvas.toBlob(resolve, 'image/jpeg', 0.95);
        };
        img.src = URL.createObjectURL(file);
    });
}

// ─── PHL LICENSE PARSER ───────────────────────────────────────────────────────
function parsePHLicense(rawText) {
    let text = rawText
        .toUpperCase()
        .replace(/[|]/g, 'I')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');

    const lines = text.split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 1);

    const result = {
        fullname:   null,
        license_no: null,
        dob:        null,
        expiry:     null,
        gender:     null,
        email:      null,
    };

    // ─── 1. LICENSE NUMBER ─────────────────────────────────────────────────────
    const rawForLicense = rawText.toUpperCase()
        .replace(/\s+/g, '')
        .replace(/[O]/g, '0');

    const licensePatterns = [
        /[A-Z]\d{2}-\d{2}-\d{6}/,
        /[A-Z]\d{2}\d{2}\d{6}/,
        /[A-Z]\d{2}[-\s]\d{2}[-\s]\d{5,7}/,
    ];

    for (const pattern of licensePatterns) {
        const match = rawForLicense.match(pattern);
        if (match) {
            let ln = match[0].replace(/\s/g, '');
            if (!ln.includes('-') && ln.length >= 9) {
                ln = `${ln[0]}${ln.slice(1,3)}-${ln.slice(3,5)}-${ln.slice(5)}`;
            }
            result.license_no = ln;
            break;
        }
    }

    // ─── 2. DATES ──────────────────────────────────────────────────────────────
    // ─── 2. DATES ──────────────────────────────────────────────────────────────
    const dateMatches = rawText.match(
        /\b\d{4}[\/\-]\d{2}[\/\-]\d{2}\b|\b\d{2}[\/\-]\d{2}[\/\-]\d{4}\b/g
    );

    if (dateMatches && dateMatches.length >= 2) {

        const formatDate = (d) => {

            // YYYY-MM-DD
            if (/^\d{4}/.test(d)) {
                return d.replace(/\//g, '-');
            }

            // MM-DD-YYYY → YYYY-MM-DD
            const parts = d.split(/[\/\-]/);

            return `${parts[2]}-${parts[0].padStart(2,'0')}-${parts[1].padStart(2,'0')}`;
        };

        const date1 = formatDate(dateMatches[0]);
        const date2 = formatDate(dateMatches[1]);

        // DOB = mas lumang taon
        const year1 = parseInt(date1.substring(0,4));
        const year2 = parseInt(date2.substring(0,4));

        if (year1 < year2) {
            result.dob = date1;
            result.expiry = date2;
        } else {
            result.dob = date2;
            result.expiry = date1;
        }
    }

    // ─── 3. GENDER ─────────────────────────────────────────────────────────────
    // PHL license: "SEX" label, tapos "M" o "F" sa susunod na line o same line
    // ─── 3. GENDER ─────────────────────────────────────────────────────────────

    // Strategy 1 — line with SEX/GENDER
    for (let i = 0; i < lines.length; i++) {

        const line = lines[i].toUpperCase();

        if (line.includes('SEX') || line.includes('GENDER')) {

            // SAME LINE
            if (
                line.includes(' MALE') ||
                /SEX[\s:]*M/.test(line)
            ) {
                result.gender = 'Male';
                break;
            }

            if (
                line.includes(' FEMALE') ||
                /SEX[\s:]*F/.test(line)
            ) {
                result.gender = 'Female';
                break;
            }

            // NEXT LINE
            const next = (lines[i + 1] || '').trim().toUpperCase();

            if (
                next === 'M' ||
                next === 'MM' ||
                next === 'MALE'
            ) {
                result.gender = 'Male';
                break;
            }

            if (
                next === 'F' ||
                next === 'FF' ||
                next === 'FEMALE'
            ) {
                result.gender = 'Female';
                break;
            }
        }
    }

    // Strategy 2 — fallback
    if (!result.gender) {

        for (let i = 0; i < lines.length; i++) {

            const l = lines[i].trim().toUpperCase();

            if (
                l === 'M' ||
                l === 'MM' ||
                l === 'MALE'
            ) {
                result.gender = 'Male';
                break;
            }

            if (
                l === 'F' ||
                l === 'FF' ||
                l === 'FEMALE'
            ) {
                result.gender = 'Female';
                break;
            }
        }
    }

    // ─── 4. FULL NAME ──────────────────────────────────────────────────────────
    const nonNameKeywords = [
        'REPUBLIC', 'PHILIPPINES', 'LICENSE', 'DRIVER', 'LAND', 'TRANSPORTATION',
        'EXPIR', 'BIRTH', 'NATIONALITY', 'ADDRESS', 'RESTRICTION', 'SEX', 'HEIGHT',
        'WEIGHT', 'BLOOD', 'CIVIL', 'AGENCY', 'OFFICIAL', 'DATE', 'ISSUED', 'LTO',
        'OFFICE', 'CONDITION', 'CODE', 'NO.', 'NUMBER', 'CLASS', 'NOTE', 'SIGNATURE',
        'GENDER', 'MIDDLE', 'FIRST', 'GIVEN', 'LAST', 'FAMILY', 'SURNAME'
    ];

    // Strategy 1: Label-based
    const nameLabels = ['LAST NAME', 'SURNAME', 'FAMILY NAME'];
    for (let i = 0; i < lines.length; i++) {
        if (nameLabels.some(lbl => lines[i].includes(lbl))) {
            for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
                const candidate = cleanName(lines[j]);
                if (candidate && candidate.length >= 3 && !hasNonNameKeyword(lines[j], nonNameKeywords)) {
                    // Try to combine with first name
                    let fullname = candidate;
                    for (let k = j + 1; k < Math.min(j + 5, lines.length); k++) {
                        if (lines[k].includes('FIRST NAME') || lines[k].includes('GIVEN NAME')) {
                            const fn = cleanName(lines[k + 1] || '');
                            if (fn) fullname = `${candidate}, ${fn}`;
                            break;
                        }
                    }
                    result.fullname = toProperCase(fullname);
                    break;
                }
            }
            if (result.fullname) break;
        }
    }

    // Strategy 2: Line after "MIDDLE NAME" (original approach — still useful)
    if (!result.fullname) {
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('MIDDLE NAME')) {
                const candidate = cleanName(lines[i + 1] || '');
                if (candidate && candidate.length >= 3) {
                    result.fullname = toProperCase(candidate);
                    break;
                }
            }
        }
    }

    // Strategy 3: Longest clean name-like line
    if (!result.fullname) {
        const nameCandidates = lines.filter(line => {
            if (hasNonNameKeyword(line, nonNameKeywords)) return false;
            if (line.length < 5 || line.length > 60) return false;
            const letterRatio = line.replace(/[^A-Z]/g, '').length / line.length;
            return letterRatio > 0.75 && /[A-Z]{2,}/.test(line);
        });

        if (nameCandidates.length > 0) {
            const withComma = nameCandidates.filter(l => l.includes(','));
            const best = withComma.length > 0
                ? withComma.reduce((a, b) => a.length >= b.length ? a : b)
                : nameCandidates.reduce((a, b) => a.length >= b.length ? a : b);
            result.fullname = toProperCase(cleanName(best));
        }
    }

    return result;
}

// ─── HELPER FUNCTIONS ─────────────────────────────────────────────────────────

function cleanName(str) {
    return str
        .replace(/[0-9]/g, '')
        .replace(/[^A-Z\s,.\-'Ñ]/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

function hasNonNameKeyword(str, keywords) {
    return keywords.some(kw => str.toUpperCase().includes(kw));
}

function toProperCase(str) {
    return str.toLowerCase().replace(/(?:^|\s|,|-|')(\S)/g, c => c.toUpperCase());
}

// ─── KEEP THESE — unchanged from your original ────────────────────────────────

function togglePassword() {
    const passwordField = document.getElementById("password");
    passwordField.type = passwordField.type === "password" ? "text" : "password";
}

document.addEventListener('DOMContentLoaded', function () {
    const dobInput = document.getElementById('dob');
    const ageInput = document.getElementById('age');
    if (dobInput) {
        dobInput.addEventListener('change', function () {
            ageInput.value = calculateAge(this.value);
        });
    }
});