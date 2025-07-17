const pool = require('./db');

async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('✅ Database connected successfully!');
    
    // Test if datasets table exists and check its structure
    const tableCheck = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'datasets'
      ORDER BY ordinal_position
    `);
    
    if (tableCheck.rows.length > 0) {
      console.log('✅ datasets table exists with columns:');
      tableCheck.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type}`);
      });
    } else {
      console.log('❌ datasets table does not exist');
    }
    
    // Test inserting a sample record
    const testInsert = await client.query(`
      INSERT INTO datasets (filename, originalname, size, mimetype, metadata)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, created_at
    `, ['test.csv', 'test.csv', 1024, 'text/csv', JSON.stringify({test: 'data'})]);
    
    console.log('✅ Test insert successful:', testInsert.rows[0]);
    
    // Clean up test data
    await client.query('DELETE FROM datasets WHERE filename = $1', ['test.csv']);
    console.log('✅ Test data cleaned up');
    
    client.release();
  } catch (err) {
    console.error('❌ Database error:', err.message);
  } finally {
    await pool.end();
  }
}

testConnection();