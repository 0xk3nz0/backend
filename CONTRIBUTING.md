# Contributing to ft_transcendence Backend

---

## Development Workflow

<div align="center">

<img src="https://media.discordapp.net/attachments/1157749771130372217/1410735291425226752/dfa57a5ffe3d57591499b4d9a9588e35.webp?ex=68b2c1df&is=68b1705f&hm=ae8137533c8a2fe4a981d65b66309ed78bcbbb4364141482965577a8164a96b1&=&format=webp" alt="fr3atni-repo" height="400" width="400" align="right">

<div align="left">
  <h3>Table of Contents</h2>
  <ul>
    <li><a href="#branch-structure-">Branch Structure</a></li>
    <li><a href="#working-process-️">Working Process</a></li>
    <li><a href="#branch-naming-convention-️">Branch Naming Convention</a></li>
    <li><a href="#database-schema-changes-">Database Schema Changes</a></li>
    <li><a href="#code-style-">Code Style</a></li>
    <li><a href="#commit-messages-️">Commit Messages</a></li>
    <li><a href="#environment-variables-">Environment Variables</a></li>
    <li><a href="#testing-">Testing</a></li>
    <li><a href="#communication-">Communication</a></li>
    <li><a href="#project-structure-">Project Structure</a></li>
    <li><a href="#emergency-protocol-">Emergency Protocol</a></li>
  </ul>
</div>

</div>

---

### Branch Structure 🌿

- **`master`**: Protected branch for stable releases. Contains documentation, README, and license. Only accepts merges from `dev`.
- **`dev`**: Protected main working branch containing boilerplate and integrated features. No direct pushes allowed - only PRs from feature branches.
- **`feature/<task-name>`**: Individual feature branches created from `dev`.

### Working Process ⚙️

<br/>
<div align="center">
    <img hight="100" width="500" src="https://i.pinimg.com/originals/f0/8c/67/f08c67b3b6b56c2e22b7d805f8d1c082.gif">
</div>
<br/>

1. **Create Feature Branch**
   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feature/task-name
   ```

2. **Development**
   - Work on your assigned task
   - Make frequent commits with clear messages
   - Follow existing code style and structure (have fun!)

3. **Before Submitting PR**
   ```bash
   git checkout dev
   git pull origin dev
   git checkout feature/task-name
   git merge dev  # Resolve conflicts if any
   ```

4. **Submit Pull Request**
   - Create PR from your feature branch to `dev`
   - Add clear description of changes
   - Link to related Notion task
   - Request review from teammate

5. **Code Review**
   - Reviewer tests the code locally
   - Checks for code quality and consistency
   - Approves and merges PR
   - Delete feature branch after merge

### Branch Naming Convention 🏷️

- `feature/user-registration-api`
- `feature/google-oauth-integration`
- `feature/websocket-chat-system`
- `feature/jwt-2fa-security`

### Database Schema Changes 📝

- Schema changes must be coordinated between team members
- Always update schema in your feature branch
- Other team member should pull latest changes before continuing work
- Include migration files in your PR

### Code Style 🎨

- Use TypeScript strict mode
- Follow existing naming conventions
- Add proper error handling
- Include basic comments for complex logic
- Test your endpoints before submitting PR

### Commit Messages ✉️

- Use clear, descriptive commit messages
- Reference issue numbers when applicable
- Examples:
  - `feat: add user registration endpoint`
  - `fix: handle duplicate email validation`
  - `refactor: improve password hashing logic`
  - `update: jwt.plugin.ts updated, polished & errors fixed`

### Environment Variables 🌐

- **Never commit actual environment variables!!!**
- Update `.env.example` when adding new variables
- Keep sensitive data in `.env` (ignored by git)

### Testing 🧪

- Test your endpoints locally before PR
- Ensure existing functionality still works
- Document API changes in code comments ... **Mandatory!**

## Communication 💬

- Coordinate schema changes through team chat (discord?)
- Update Notion task status as you progress (leave comments!)
- Ask questions when stuck - don't waste time <- :P
- Review teammate's PRs promptly

## Project Structure 📁

structure will change overtime ... !

```
src/
├── controllers/     # Request handlers
├── services/        # Business logic
├── models/          # Database models
├── middleware/      # Auth, validation, etc.
├── routes/          # API routes
├── utils/           # Helper functions
└── types/           # TypeScript interfaces
```

## Emergency Protocol 🚨

If you accidentally break something in `dev`:
1. Create hotfix branch immediately
2. Fix the issue
3. Submit emergency PR
4. Notify teammate immediately
