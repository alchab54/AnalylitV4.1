const fs = require('fs');
const path = require('path');

console.log('🧪 Validation de la couverture AnalyLit v4.1...');

// Lire le rapport de couverture
const coveragePath = path.join(__dirname, '../coverage/coverage-summary.json');
if (fs.existsSync(coveragePath)) {
    const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
    const total = coverage.total;
    
    console.log(`📊 Couverture totale:`);
    console.log(`   Statements: ${total.statements.pct}%`);
    console.log(`   Branches: ${total.branches.pct}%`);
    console.log(`   Functions: ${total.functions.pct}%`);
    console.log(`   Lines: ${total.lines.pct}%`);
    
    if (total.statements.pct >= 60) {
        console.log('✅ Objectif de couverture atteint!');
    } else {
        console.log('⚠️  Couverture en dessous de 60%');
    }
} else {
    console.log('❌ Rapport de couverture non trouvé');
}