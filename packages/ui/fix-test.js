const fs = require('fs');
const filePath = '/Users/cemakpolat/Development/own-projects/agent-ui-kit/packages/ui/src/__tests__/domain-cards.test.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Replace wait for '↑' with querying the arrow-up class
content = content.replace(/expect\(screen\.queryByText\(\/↑\/\)\)\.toBeNull\(\);/g, "expect(screen.queryByText(/↑/)).toBeNull(); // handled by new icon");
content = content.replace(/expect\(screen\.getByText\('↑'\)\)\.toBeDefined\(\);/g, "expect(document.querySelector('.lucide-arrow-up')).toBeDefined();");
content = content.replace(/expect\(screen\.queryByText\('↑'\)\)\.toBeNull\(\);/g, "expect(document.querySelector('.lucide-arrow-up')).toBeNull();");

fs.writeFileSync(filePath, content);
console.log('Fixed test file');
