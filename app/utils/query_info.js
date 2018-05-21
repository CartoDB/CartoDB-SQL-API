const COPY_FORMATS = ['TEXT', 'CSV', 'BINARY'];

module.exports = {
    getFormatFromCopyQuery(copyQuery) {
        let format = 'TEXT'; // Postgres default format

        copyQuery = copyQuery.toUpperCase();

        if (!copyQuery.toUpperCase().startsWith("COPY ")) {
            return false;
        }
       
        const regex = /(\bFORMAT\s+)(\w+)/;
        const result = regex.exec(copyQuery);
        if (result && result.length >= 3 && COPY_FORMATS.includes(result[2])) {
            format = result[2];
        }

        return format;
    }
};
