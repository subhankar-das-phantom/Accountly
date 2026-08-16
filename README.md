# Accountly 💰

A full-stack web application for managing personal finances, tracking transactions, setting budgets, and analyzing spending patterns with beautiful visualizations.

## ✨ Features

### 📊 Dashboard & Analytics
- **Real-time Overview**: View total income, expenses, and balance at a glance
- **Interactive Charts**: Visualize spending patterns with pie charts, bar charts, and trend analysis
- **Category Breakdown**: Detailed analytics of expenses by category
- **Monthly Reports**: Track financial performance over time

### 💸 Transaction Management
- **Add/Edit/Delete Transactions**: Complete CRUD operations for managing transactions
- **Categorization**: Organize transactions by categories (Food, Transport, Entertainment, etc.)
- **Search & Filter**: Quickly find transactions by date, category, or amount
- **Bulk Operations**: Import/export transactions in Excel format
- **Virtual Scrolling**: Efficiently handle large transaction lists

### 🏢 Organization & Multi-Workspace
- **Multiple Workspaces**: Create or join multiple organizations
- **Role-based Access**: Owner and Member roles with different permissions
- **Shared Financials**: Collaborate on tracking expenses and contributions with a team
- **Custom Contributor Fields**: Define dynamic custom fields (text, select, number) for contributors

### 🌍 Public Transparency Dashboard
- **Public Link**: Enable a public-facing dashboard for your organization
- **Contributor Privacy**: Control whether contributor names are fully transparent, anonymized, or fully anonymous
- **Fund Target Goal**: Set and display a public funding target with dynamic progress tracking
- **Shared Analytics**: Allow the public to view high-level summaries and category breakdowns without exposing private settings

### 🎯 Budget Planning
- **Set Budget Goals**: Create monthly budget targets for different categories
- **Track Progress**: Monitor spending against budget limits
- **Visual Indicators**: Color-coded progress bars and alerts
- **Budget Analytics**: Compare budgeted vs. actual spending

### 🔐 Authentication & Security
- **User Registration & Login**: Secure authentication with JWT tokens
- **Password Encryption**: Bcrypt-based password hashing
- **Protected Routes**: Secure API endpoints with middleware
- **Rate Limiting**: Protection against brute-force attacks

### 📈 Advanced Features
- **PDF Report Generation**: Export financial reports as PDF
- **Data Visualization**: Powered by Recharts for beautiful, interactive charts
- **Responsive Design**: Works seamlessly on all devices with a highly optimized mobile-first approach
- **Dynamic Theming**: Custom theme colors with built-in Light/Dark modes
- **Fast & Responsive Data**: Powered by SWR for stale-while-revalidate data fetching and caching
- **Smooth Animations**: Enhanced UX with Framer Motion

## 🛠️ Tech Stack

### Frontend
- **React 19** - Modern React with latest features
- **Vite** - Lightning-fast build tool
- **React Router** - Client-side routing
- **SWR** - React Hooks for data fetching and caching
- **Material-UI (MUI)** - Component library with Material Design
- **Tailwind CSS** - Utility-first CSS framework
- **Framer Motion** - Animation library
- **Recharts** - Charting library for data visualization
- **Axios** - HTTP client for API requests
- **XLSX** - Excel file import/export

### Backend
- **Node.js & Express** - Server framework
- **MongoDB & Mongoose** - Database and ODM
- **JWT** - Authentication tokens
- **Bcrypt.js** - Password hashing
- **Helmet** - Security middleware
- **CORS** - Cross-origin resource sharing
- **Morgan** - HTTP request logger
- **Rate Limiting** - API protection
- **PDFKit** - PDF generation

## 📁 Project Structure

```
personal-finance-tracker/
├── backend/
│   ├── config/         # Configuration files
│   ├── controllers/    # Route controllers
│   ├── middleware/     # Custom middleware (auth, etc.)
│   ├── models/         # MongoDB models
│   ├── routes/         # API routes
│   ├── server.js       # Express server setup
│   └── package.json
│
├── frontend/
│   ├── public/         # Static assets
│   ├── src/
│   │   ├── assets/     # Images, fonts, etc.
│   │   ├── components/ # Reusable React components
│   │   ├── context/    # React Context providers
│   │   ├── hooks/      # Custom React hooks
│   │   ├── pages/      # Page components
│   │   ├── services/   # API service layer
│   │   ├── App.jsx     # Main App component
│   │   └── main.jsx    # Entry point
│   ├── vite.config.js
│   └── package.json
│
└── README.md
```

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v16 or higher)
- **MongoDB** (local installation or MongoDB Atlas account)
- **npm** or **yarn**

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd personal-finance-tracker
   ```

2. **Set up Backend**
   ```bash
   cd backend
   npm install
   ```

   Create a `.env` file in the `backend` directory:
   ```env
   ATLAS_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/finance-tracker
   JWT_SECRET=your_jwt_secret_key_here
   PORT=5000
   NODE_ENV=development
   FRONTEND_URL=http://localhost:5173
   ```

3. **Set up Frontend**
   ```bash
   cd ../frontend
   npm install
   ```

   Create a `.env` file in the `frontend` directory:
   ```env
   VITE_API_URL=http://localhost:5000/api
   ```

### Running the Application

1. **Start the Backend Server**
   ```bash
   cd backend
   npm run dev
   ```
   Server will run on `http://localhost:5000`

2. **Start the Frontend Development Server**
   ```bash
   cd frontend
   npm run dev
   ```
   Application will open at `http://localhost:5173`

## 📚 API Endpoints

### Users & Authentication
- `POST /api/users/register` - Register new user
- `POST /api/users/login` - Login user
- `GET /api/users/me` - Get user data (protected)
- `PUT /api/users/me` - Update user profile (protected)
- `PUT /api/users/me/password` - Change password (protected)
- `PUT /api/users/me/theme` - Update theme preferences (protected)
- `PUT /api/users/me/currency` - Update currency preferences (protected)
- `DELETE /api/users/me` - Delete account and associated data (protected)

### Organizations & Workspaces
- `POST /api/organizations` - Create an organization
- `GET /api/organizations` - Get all organizations for user
- `GET /api/organizations/:id` - Get specific organization details
- `PUT /api/organizations/:id` - Update organization details
- `DELETE /api/organizations/:id` - Delete organization
- `PATCH /api/organizations/:id/public-settings` - Update public transparency settings

### Organization Members
- `GET /api/organizations/memberships` - Get all user memberships
- `GET /api/organizations/:id/members` - Get organization members
- `POST /api/organizations/:id/members` - Add member to organization
- `PUT /api/organizations/:id/members/:memberId` - Update member role
- `DELETE /api/organizations/:id/members/:memberId` - Remove member

### Contributor Fields
- `GET /api/organizations/:id/contributor-fields` - Get custom fields
- `POST /api/organizations/:id/contributor-fields` - Add custom field
- `PUT /api/organizations/:id/contributor-fields/:key` - Update custom field
- `DELETE /api/organizations/:id/contributor-fields/:key` - Delete custom field

### Transactions
- `GET /api/transactions` - Get all transactions (scoped by organization)
- `POST /api/transactions` - Create transaction
- `PUT /api/transactions/:id` - Update transaction
- `DELETE /api/transactions/:id` - Delete transaction

### Public Dashboard
- `GET /api/public/organizations/:slug` - Get organization public summary
- `GET /api/public/organizations/:slug/contributions` - Get public contributions
- `GET /api/public/organizations/:slug/expenses` - Get public expenses
- `GET /api/public/organizations/:slug/analytics` - Get public analytics

### Reports & Audit
- `GET /api/organizations/:id/reports/pdf` - Generate PDF report
- `GET /api/organizations/:id/reports/excel` - Generate Excel report
- `GET /api/organizations/:id/audit-logs` - Get audit logs
- `GET /api/organizations/:id/integrity-check` - Check financial integrity

### Budget
- `GET /api/budget` - Get budget goals (protected)
- `POST /api/budget` - Create budget goal (protected)
- `PUT /api/budget/:id` - Update budget goal (protected)
- `DELETE /api/budget/:id` - Delete budget goal (protected)

### Health
- `GET /health` - Server health check

## 🔒 Security Features

- **JWT Authentication** - Secure token-based authentication
- **Password Hashing** - Bcrypt encryption for user passwords
- **Helmet.js** - Security headers for Express apps
- **Rate Limiting** - 1000 requests per minute per IP
- **CORS Protection** - Configured allowed origins
- **Input Validation** - Server-side validation for all inputs
- **MongoDB Injection Protection** - Safe query practices with Mongoose

## 🎨 UI/UX Features

- **Modern Design** - Clean, intuitive interface with dynamic theme gradients
- **Personalized Appearance** - Customizable theme colors and light/dark modes
- **Responsive Layout** - Highly optimized mobile-first design approach
- **Interactive Charts** - Click and hover interactions on charts
- **Optimistic UI** - Snappy user experience powered by SWR caching
- **Loading States** - Smooth loading indicators
- **Error Handling** - User-friendly error messages
- **Form Validation** - Real-time form validation
- **Smooth Transitions** - Framer Motion animations

## 📦 Build for Production

### Frontend
```bash
cd frontend
npm run build
```
This creates an optimized build in the `frontend/dist` directory.

### Backend
The backend server will automatically serve the frontend build in production mode when `NODE_ENV=production`.

### Deployment
The application includes a `vercel.json` configuration for easy deployment to Vercel or similar platforms.

## 🧪 Development Tips

- **Hot Reload**: Both frontend (Vite) and backend (nodemon) support hot reloading
- **Debugging**: Use browser DevTools for frontend and Node.js debugger for backend
- **Database**: Use MongoDB Compass to visualize your database
- **API Testing**: Use Postman or Thunder Client to test API endpoints

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is open source and available under the MIT License.

## 🐛 Known Issues

- None currently. Please report any bugs by opening an issue.

## 📧 Contact

For questions or support, please open an issue in the repository.

---

**Happy Tracking! 💰📊**
