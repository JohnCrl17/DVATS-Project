const mysql = require('mysql2/promise');

// I-setup ang database connection papunta sa dvats_db (Mobile database mo)
const dbConfig = {
    host: 'localhost',
    user: 'root',      // Palitan mo kung may ibang user ang HeidiSQL mo pre
    password: '',      // Ilagay ang password ng MySQL mo kung mayroon
    database: 'dvats_db'
};

// ─── STAGE 1: VERIFY BADGE NUMBER & GENERATE OTP ─────────────────────────────
exports.verifyBadge = async (req, res) => {
    const { badge_number } = req.body;
    let connection;

    try {
        connection = await mysql.createConnection(dbConfig);
        
        // 1. Suriin kung umiiral ang badge_number sa dvats_db.enforcers
        const [rows] = await connection.execute(
            'SELECT status, email FROM enforcers WHERE badge_number = ?', 
            [badge_number]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Hindi rehistrado ang Badge Number na ito sa TMO.' });
        }

        const enforcer = rows[0];

        // 2. Check ang account state status
        if (enforcer.status === 'LOCKED') {
            return res.status(403).json({ message: 'TERMINAL LOCKED: Ang account na ito ay kasalukuyang naka-lock. Mag-report sa Dasma TMO Head Office.' });
        }
        if (enforcer.status === 'ACTIVE') {
            return res.status(400).json({ message: 'Account na-activate na! Mangyaring pumunta sa Login screen.' });
        }

        // 3. Kung PENDING, mag-generate ng simulated 6-digit OTP
        const simulatedOTP = Math.floor(100000 + Math.random() * 900000).toString();

        // 4. I-save ang OTP sa database para may panama tayo mamaya
        await connection.execute(
            'UPDATE enforcers SET registration_otp = ?, otp_attempts = 0 WHERE badge_number = ?',
            [simulatedOTP, badge_number]
        );

        // DEV NOTE: Dahil wala ka pang email module, ibabalik natin ang OTP sa response 
        // para makita mo sa terminal/console ng React Native habang nag-de-demo ka sa panel!
        return res.status(200).json({ 
            message: 'Identity Verified. OTP stored inside security node.',
            otp: simulatedOTP // Pwede mo itong tanggalin kapag live production na talaga pre
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Database query error sa server node.' });
    } finally {
        if (connection) await connection.end();
    }
};

// ─── STAGE 2: VERIFY OTP LOGIC & ACCOUNT LOCKDOWN ────────────────────────────
exports.verifyOtp = async (req, res) => {
    const { badge_number, otp } = req.body;
    let connection;

    try {
        connection = await mysql.createConnection(dbConfig);

        // Kunin ang nakatagong OTP at kasalukuyang attempts
        const [rows] = await connection.execute(
            'SELECT registration_otp, otp_attempts, status FROM enforcers WHERE badge_number = ?',
            [badge_number]
        );

        if (rows.length === 0) return res.status(404).json({ message: 'Enforcer record not found.' });
        
        const enforcer = rows[0];

        if (enforcer.status === 'LOCKED') {
            return res.status(403).json({ message: 'Account is already locked.' });
        }

        // TUGMA: Tama ang pinasok na OTP!
        if (enforcer.registration_otp === otp) {
            // I-clear ang OTP field pero hayaan munang PENDING hanggang mag-set ng password
            await connection.execute(
                'UPDATE enforcers SET registration_otp = NULL, otp_attempts = 0 WHERE badge_number = ?',
                [badge_number]
            );
            return res.status(200).json({ message: 'Security payload matched! Proceed to password creation.' });
        } 
        
        // SABLAY: Maling OTP ang naitype
        else {
            const newAttempts = enforcer.otp_attempts + 1;

            if (newAttempts >= 2) {
                // I-lock na ang system node sa database! (Eto yung gusto ng panel mo pre)
                await connection.execute(
                    "UPDATE enforcers SET status = 'LOCKED', registration_otp = NULL, otp_attempts = ? WHERE badge_number = ?",
                    [newAttempts, badge_number]
                );
                return res.status(423).json({ message: 'Maximum attempts reached. System profile locked.' });
            } else {
                // I-update lang ang attempt count
                await connection.execute(
                    'UPDATE enforcers SET otp_attempts = ? WHERE badge_number = ?',
                    [newAttempts, badge_number]
                );
                return res.status(400).json({ message: 'Maling security code.' });
            }
        }

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal server verification failure.' });
    } finally {
        if (connection) await connection.end();
    }
};

// ─── STAGE 3: ACCOUNT ACTIVATION (SET PASSWORD) ──────────────────────────────
exports.activateAccount = async (req, res) => {
    const { badge_number, password } = req.body;
    let connection;

    try {
        connection = await mysql.createConnection(dbConfig);

        // I-update ang password at baguhin ang status mula PENDING papuntang ACTIVE
        // TIP: Sa totoong app gagamit ka ng bcrypt.hash para sa password, pero para mabilis sa defense, plain text o diretso muna.
        const [result] = await connection.execute(
            "UPDATE enforcers SET password = ?, status = 'ACTIVE' WHERE badge_number = ?",
            [password, badge_number]
        );

        if (result.affectedRows > 0) {
            return res.status(200).json({ message: 'Enforcer node synchronized successfully. Account is now active!' });
        } else {
            return res.status(400).json({ message: 'Failed to update activation payload.' });
        }

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server activation error.' });
    } finally {
        if (connection) await connection.end();
    }
};