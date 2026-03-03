const fs = require('fs');

const targetFile = 'client/src/components/builder/canvas-block.tsx';
let b = fs.readFileSync(targetFile, 'utf8');

// Safely upgrade all grid blocks to be responsive (mobile-first)
b = b.replace(/className="grid grid-cols-4(.*?)"/g, 'className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4$1"');
b = b.replace(/className="grid grid-cols-3(.*?)"/g, 'className="grid grid-cols-1 md:grid-cols-3$1"');
b = b.replace(/className="grid grid-cols-2(.*?)"/g, 'className="grid grid-cols-1 md:grid-cols-2$1"');

// Make the footer links wrap properly on mobile
b = b.replace(/className="grid grid-cols-3 gap-4 mb-4"/g, 'className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4"');

// Fix flex header/navbar layout on mobile 
b = b.replace(/className="flex items-center justify-between p-4/g, 'className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4');

fs.writeFileSync(targetFile, b);
console.log("Responsive grid classes applied!");
