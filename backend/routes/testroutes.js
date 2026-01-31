const express = require("express");
const router = express.Router();
const db = require("../db");
const evaluateAnswer = require("../gemini");

/* ---------------- TEST ---------------- */

router.get("/test", (req, res) => {
  res.json({ message: "API Working Successfully" });
});

/* ------------- ADD TASK (CUSTOM CHALLENGE) ------------ */

router.post("/add-task", (req, res) => {
  const { title, description, sample_code, max_marks } = req.body;

  if (!title || !description) {
    return res.status(400).json({ message: "Title and description are required" });
  }

  const sql =
    "INSERT INTO coding_tasks (title, description, sample_code, max_marks) VALUES (?,?,?,?)";

  db.query(sql, [title, description, sample_code || "", max_marks || 100], (err) => {
    if (err) return res.status(500).json({ error: err.message });

    res.json({ message: "Challenge Created Successfully" });
  });
});

/* ------------- UPDATE TASK ------------ */

router.put("/update-task/:id", (req, res) => {
  const { id } = req.params;
  const { title, description, sample_code, max_marks } = req.body;

  if (!title || !description) {
    return res.status(400).json({ message: "Title and description are required" });
  }

  const sql =
    "UPDATE coding_tasks SET title=?, description=?, sample_code=?, max_marks=? WHERE id=?";

  db.query(sql, [title, description, sample_code || "", max_marks || 100, id], (err) => {
    if (err) return res.status(500).json({ error: err.message });

    res.json({ message: "Challenge Updated Successfully" });
  });
});

/* ----------- GET TASKS -------------- */

router.get("/tasks", (req, res) => {
  db.query("SELECT * FROM coding_tasks", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

/* ----------- SUBMIT CODE (AI) ----------- */

router.post("/submit-code", async (req, res) => {
  const { task_id, user_id, student_code, language } = req.body;

  if (!task_id || !student_code) {
    return res.status(400).json({ message: "Missing fields" });
  }

  db.query(
    "SELECT * FROM coding_tasks WHERE id=?",
    [task_id],
    async (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (rows.length === 0)
        return res.status(404).json({ message: "Task not found" });

      const task = rows[0];

      try {
        const aiResult = await evaluateAnswer(
          task.description,
          student_code,
          language || "javascript",
          task.max_marks
        );

        db.query(
          "INSERT INTO student_submissions(task_id, user_id, code_content, feedback, improvements, grade, scored_marks) VALUES (?,?,?,?,?,?,?)",
          [
            task_id,
            user_id || null, // Allow guest submissions for now
            student_code,
            aiResult.feedback,
            JSON.stringify(aiResult.improvements),
            aiResult.grade,
            aiResult.score
          ],
          (err) => {
            if (err) console.error("Database Save Error:", err.message);
          }
        );

        res.json(aiResult);
      } catch (err) {
        console.error("AI Evaluation Failed:", err.message);
        res.status(500).json({ error: "AI Evaluation Failed" });
      }
    }
  );
});

module.exports = router;
