const COPY_FORMATS = ['TEXT', 'CSV', 'BINARY'];

module.exports = {
    getFormatFromCopyQuery(copyQuery) {
        let format = 'TEXT'; // Postgres default format

        copyQuery = copyQuery.toUpperCase();

        if (!copyQuery.startsWith("COPY ")) {
            return false;
        }
        
        if(copyQuery.includes(' WITH') && copyQuery.includes('FORMAT ')) {
            const regex = /\bFORMAT\s+(\w+)/;
            const result = regex.exec(copyQuery);
    
            if (result && result.length === 2) {
                if (COPY_FORMATS.includes(result[1])) {
                    format = result[1];
                    format = format.toUpperCase();
                } else {
                    format = false;
                }
            }
        }

        return format;
    }
};
