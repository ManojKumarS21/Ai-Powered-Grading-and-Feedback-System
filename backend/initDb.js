const db = require("./db");

const initDb = () => {
    const createTasksTable = `
    CREATE TABLE IF NOT EXISTS coding_tasks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      sample_code TEXT,
      max_marks INT DEFAULT 100
    );
  `;

    const createSubmissionsTable = `
    CREATE TABLE IF NOT EXISTS student_submissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      task_id INT,
      user_id INT,
      code_content TEXT NOT NULL,
      feedback TEXT,
      improvements TEXT,
      grade VARCHAR(10),
      scored_marks INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES coding_tasks(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `;

    db.query(createTasksTable, (err) => {
        if (err) {
            console.error("Error creating coding_tasks table:", err.message);
        } else {
            console.log("Table 'coding_tasks' ready.");

            // Create submissions table only after tasks table is ready
            db.query(createSubmissionsTable, (err) => {
                if (err) {
                    console.error("Error creating student_submissions table:", err.message);
                } else {
                    console.log("Table 'student_submissions' ready.");

                    // Add default task if none exists
                    db.query("SELECT COUNT(*) as count FROM coding_tasks", (err, rows) => {
                        if (!err && rows[0].count === 0) {
                            const defaultTask = [
                                "Write a function that takes a string as input and returns the string reversed.",
                                "Reverse a String",
                                '// Example:\n// reverse("hello") -> "olleh"',
                                10
                            ];
                            db.query("INSERT INTO coding_tasks (description, title, sample_code, max_marks) VALUES (?,?,?,?)", defaultTask);
                        }
                    });
                }
            });
        }
    });
};

module.exports = initDb;
