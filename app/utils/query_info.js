const COPY_FORMATS = ['TEXT', 'CSV', 'BINARY'];

module.exports = {
    getFormatFromCopyQuery(copyQuery) {
        let format = 'TEXT'; // Postgres default format

        copyQuery = copyQuery.toUpperCase();

        if (!copyQuery.toUpperCase().startsWith("COPY ")) {
            return false;
        }
       
        const regex = /\bFORMAT\s+(\w+)/;
        const result = regex.exec(copyQuery);
        if (result && result.length === 2 && COPY_FORMATS.includes(result[1])) {
            format = result[1];
        }

        return format;
    }
};
