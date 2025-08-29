# Contributing to ft_transcendence Backend

## Development Workflow

### Branch Structure

- **`master`**: Protected branch for stable releases. Contains documentation, README, and license. Only accepts merges from `dev`.
- **`dev`**: Protected main working branch containing boilerplate and integrated features. No direct pushes allowed - only PRs from feature branches.
- **`feature/<task-name>`**: Individual feature branches created from `dev`.

### Working Process

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

### Branch Naming Convention

- `feature/user-registration-api`
- `feature/google-oauth-integration`
- `feature/websocket-chat-system`
- `feature/jwt-2fa-security`

### Database Schema Changes

- Schema changes must be coordinated between team members
- Always update schema in your feature branch
- Other team member should pull latest changes before continuing work
- Include migration files in your PR

### Code Style

- Use TypeScript strict mode
- Follow existing naming conventions
- Add proper error handling
- Include basic comments for complex logic
- Test your endpoints before submitting PR

### Commit Messages

- Use clear, descriptive commit messages
- Reference issue numbers when applicable
- Examples:
  - `feat: add user registration endpoint`
  - `fix: handle duplicate email validation`
  - `refactor: improve password hashing logic`
  - `update: jwt.plugin.ts updated, polished & errors fixed`

### Environment Variables

- **Never commit actual environment variables!!!**
- Update `.env.example` when adding new variables
- Keep sensitive data in `.env` (ignored by git)

### Testing

- Test your endpoints locally before PR
- Ensure existing functionality still works
- Document API changes in code comments ... **Mandatory!**

## Communication

- Coordinate schema changes through team chat (discord?)
- Update Notion task status as you progress (leave comments!)
- Ask questions when stuck - don't waste time <- :P
- Review teammate's PRs promptly

## Project Structure

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

## Emergency Protocol

If you accidentally break something in `dev`:
1. Create hotfix branch immediately
2. Fix the issue
3. Submit emergency PR
4. Notify teammate immediately