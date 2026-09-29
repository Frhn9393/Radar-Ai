function csvRow(values) {
    const cells = values.map(value => {
        let text = String(value ?? '').replace(/\r\n?|\n/g, ' ');
        const numericLiteral = /^-?(?:\d+\.?\d*|\.\d+)%?$/.test(text);
        if (!numericLiteral && /^[\t ]*[=+@-]/.test(text)) text = `'${text}`;
        return `"${text.replace(/"/g, '""')}"`;
    });
    return `${cells.join(',')}\n`;
}

if (typeof module !== 'undefined' && module.exports) module.exports = { csvRow };
