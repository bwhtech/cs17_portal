import { Page } from "@playwright/test";

const student = {
  name: "STU-2024-001",
  full_name: "Alex Johnson",
  cohort: "CS17-2024",
  profile_picture: "",
};

const mockBoot = {
  student,
  user: "test@example.com",
  current_user: "test@example.com",
  csrf_token: "test-csrf-token",
  lang: "en",
  sitename: "localhost",
  sysdefaults: {},
};

const assignments = {
  data: [
    {
      name: "ASGN-001",
      title: "Problem Set 1",
      due_date: "2030-12-31 23:59:59",
      max_marks: 100,
      assignment_type: "Graded",
    },
    {
      name: "ASGN-002",
      title: "Problem Set 2",
      due_date: "2020-01-01 23:59:59",
      max_marks: 50,
      assignment_type: "Graded",
    },
    {
      name: "ASGN-003",
      title: "Lab Report",
      due_date: "2030-11-30 23:59:59",
      max_marks: 25,
      assignment_type: "Not Graded",
    },
  ],
};

const submissions = {
  data: [
    {
      name: "SUB-001",
      assignment: "ASGN-002",
      submitted_at: "2019-12-20 10:00:00",
      modified: "2019-12-20 10:00:00",
    },
  ],
};

const grades = {
  data: [
    {
      name: "GRD-001",
      assignment: "ASGN-002",
      submission: "SUB-001",
      marks_obtained: 45,
      grade: null,
      evaluation_type: "Marks",
      remarks: "Good work on problem 3.",
    },
  ],
};

const announcements = {
  data: [
    {
      name: "ANN-001",
      title: "Welcome to CS17",
      content: "Welcome to the course!",
      alert_variant: "info",
      is_dismissible: 1,
      published_date: "2024-01-15",
    },
    {
      name: "ANN-002",
      title: "Assignment 1 Due Soon",
      content: "Problem Set 1 is due at the end of the month.",
      alert_variant: "warning",
      is_dismissible: 0,
      published_date: "2024-01-20",
    },
  ],
};

const assignmentDetail = {
  data: {
    name: "ASGN-001",
    title: "Problem Set 1",
    due_date: "2030-12-31 23:59:59",
    max_marks: 100,
    assignment_type: "Graded",
    description: "<p>Complete problems 1 through 5.</p>",
  },
};

export async function setupMocks(page: Page) {
  // React Fast Refresh globals (must be set before page scripts run)
  await page.addInitScript(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    w.__vite_plugin_react_preamble_installed__ = true;
    w.$RefreshReg$ = () => {};
    w.$RefreshSig$ = () => () => {};
  });

  // Serve index.html with Jinja templates replaced (Vite doesn't process them)
  await page.route(/\/dashboard(\?.*)?$/, async (route) => {
    if (route.request().resourceType() !== "document") {
      return route.continue();
    }

    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/assets/cs17_portal/dashboard/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CS17 Portal</title>
    <script type="module" src="/src/main.tsx"></script>
  </head>
  <body>
    <div id="root"></div>
    <script>
      window.frappe_boot = ${JSON.stringify(mockBoot)};
      window.csrf_token = 'test-csrf-token';
    </script>
  </body>
</html>`;

    await route.fulfill({ status: 200, contentType: "text/html", body: html });
  });

  // Mock auth check
  await page.route(/\/api\/method\/frappe\.auth\.get_logged_user/, (route) =>
    route.fulfill({ json: { message: "test@example.com" } }),
  );

  // Resource mocks — most specific first
  await page.route(/\/api\/resource\/CS17%20Assignment%20Submission/, (route) =>
    route.fulfill({ json: submissions }),
  );

  await page.route(/\/api\/resource\/CS17%20Assignment%20Grade/, (route) =>
    route.fulfill({ json: grades }),
  );

  await page.route(/\/api\/resource\/CS17%20Announcement/, (route) =>
    route.fulfill({ json: announcements }),
  );

  await page.route(/\/api\/resource\/CS17%20Assignment\//, (route) =>
    route.fulfill({ json: assignmentDetail }),
  );

  await page.route(/\/api\/resource\/CS17%20Assignment(\?|$)/, (route) =>
    route.fulfill({ json: assignments }),
  );

  // Catch-all for any other API calls
  await page.route(/\/api\//, (route) =>
    route.fulfill({ status: 200, json: { message: null } }),
  );
}
