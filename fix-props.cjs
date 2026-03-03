const fs = require('fs');

const targetFile = 'client/src/components/builder/canvas-block.tsx';
let b = fs.readFileSync(targetFile, 'utf8');

const replacements = [
    { block: 'product-card', target: 'props.products' },
    { block: 'pricing-table', target: 'props.plans' },
    { block: 'testimonials', target: 'props.testimonials' },
    { block: 'faq', target: 'props.items' },
    { block: 'stats', target: 'props.stats' },
    { block: 'team', target: 'props.members' },
    { block: 'logo-cloud', target: 'props.logos' },
    { block: 'blog-list', target: 'props.posts' },
    { block: 'cart', target: 'props.items' },
    { block: 'features', target: 'props.features' },
];

for (const rep of replacements) {
    const searchFor = 'props.links?.length ? props.links :';
    const replaceWith = rep.target + '?.length ? ' + rep.target + ' :';
    const blockStart = 'case "' + rep.block + '":';

    const blockIndex = b.indexOf(blockStart);
    if (blockIndex === -1) continue;

    const nextCaseIndex = b.indexOf('case "', blockIndex + 10);
    const endSearchIndex = nextCaseIndex !== -1 ? nextCaseIndex : b.indexOf('default:');

    const blockContent = b.substring(blockIndex, endSearchIndex);
    const updatedBlockContent = blockContent.replace(searchFor, replaceWith);

    b = b.substring(0, blockIndex) + updatedBlockContent + b.substring(endSearchIndex);
}

fs.writeFileSync(targetFile, b);
console.log("Replacements complete.");
