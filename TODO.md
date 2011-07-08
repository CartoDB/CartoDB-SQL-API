Prioritized todo
-----------------

Add integration tests for URL rows_per_page and page params

move to fully chunked row by row evented pg model (maybe)



trim out the_geom_webmercator using something like:

SELECT 'SELECT ' || array_to_string(ARRAY(SELECT 'o' || '.' || c.column_name
        FROM information_schema.columns As c
            WHERE table_name = 'zonas_reparto' 
            AND  c.column_name NOT IN('the_geom_webmercator', 'the_geom')
    ), ',') || ' FROM zonas_reparto As o' As sqlstmt
    
    
or

SELECT array_to_string(ARRAY(SELECT 'o' || '.' || c.column_name
        FROM information_schema.columns As c
            WHERE table_name = 'zonas_reparto' 
            AND  c.column_name NOT IN('the_geom_webmercator', 'the_geom')
    ), ',') As sqlstmt    