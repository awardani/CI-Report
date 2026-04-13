const normalizeText = (value) => {
  if (typeof value !== 'string') {
    return value ?? null;
  }

  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

const normalizeNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeTimestamp = (value) => {
  const normalized = normalizeText(value);

  if (!normalized) {
    return null;
  }

  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
};

const datePart = (timestamp) => (timestamp ? timestamp.slice(0, 10) : null);

const buildDateBounds = (items, fieldName) => {
  const dates = items.map((item) => datePart(item[fieldName])).filter(Boolean);

  if (dates.length === 0) {
    return { minDate: '', maxDate: '' };
  }

  return {
    minDate: dates.reduce((min, value) => (value < min ? value : min), dates[0]),
    maxDate: dates.reduce((max, value) => (value > max ? value : max), dates[0]),
  };
};

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const normalizeUserRow = (row) => ({
  user_id: normalizeText(row.user_id),
  created_at: normalizeTimestamp(row.created_at),
  last_login_at: normalizeTimestamp(row.last_login_at),
  email: normalizeText(row.email),
  role: normalizeText(row.role),
  is_admin: Boolean(row.is_admin),
  is_instructor: Boolean(row.is_instructor),
  is_suspended: Boolean(row.is_suspended),
});

const normalizeCourseRow = (row) => ({
  course_id: normalizeText(row.course_id),
  course_name: normalizeText(row.course_name ?? row.title),
  course_url: normalizeText(
    row.course_url ??
      row.url ??
      row.permalink ??
      row.public_url ??
      row.identifiers?.url ??
      row.identifiers?.public_url
  ),
  created_at: normalizeTimestamp(row.created_at),
  updated_at: normalizeTimestamp(row.updated_at),
  author_name: normalizeText(row.author_name),
  categories: ensureArray(row.categories).map(normalizeText).filter(Boolean),
  access: normalizeText(row.access),
});

const normalizeEnrollmentRow = (row, usersById, coursesById) => {
  const userId = normalizeText(row.user_id);
  const courseId = normalizeText(row.course_id);

  return {
    enrollment_id: normalizeText(row.enrollment_id),
    user_id: userId,
    course_id: courseId,
    enrolled_at: normalizeTimestamp(row.enrolled_at),
    expires_at: normalizeTimestamp(row.expires_at),
    user_role: normalizeText(row.user_role),
    enrollment_id_is_synthetic: Boolean(
      row.enrollment_id_is_synthetic ||
        row.source_endpoint === 'course-users' ||
        row.source_endpoint === 'user-courses'
    ),
    user_found: Boolean(userId && usersById.has(userId)),
    course_found: Boolean(courseId && coursesById.has(courseId)),
  };
};

const buildUserCourseKey = (userId, courseId) => `${userId || ''}:${courseId || ''}`;

const normalizeProgressStatus = (value) => {
  const normalized = normalizeText(value);
  return normalized ? normalized.toLowerCase() : null;
};

const normalizeCourseProgressRow = (row, usersById, coursesById) => {
  const userId = normalizeText(row.user_id);
  const courseId = normalizeText(row.course_id);
  const progressPercent = normalizeNumber(row.progress_percent);
  const completedAt = normalizeTimestamp(row.completed_at);
  const status = normalizeProgressStatus(row.progress_status);

  return {
    user_id: userId,
    course_id: courseId,
    progress_status: status,
    progress_percent: progressPercent,
    average_score_percent: normalizeNumber(row.average_score_percent),
    time_spent_seconds: normalizeNumber(row.time_spent_seconds),
    completed_at: completedAt,
    last_activity_at: normalizeTimestamp(row.last_activity_at),
    completed_units: normalizeNumber(row.completed_units),
    total_units: normalizeNumber(row.total_units),
    user_found: Boolean(userId && usersById.has(userId)),
    course_found: Boolean(courseId && coursesById.has(courseId)),
    progress_key: buildUserCourseKey(userId, courseId),
    has_activity_timestamp: Boolean(normalizeTimestamp(row.last_activity_at) || completedAt),
    is_completed:
      Boolean(completedAt) ||
      progressPercent === 100 ||
      status === 'completed' ||
      status === 'passed',
  };
};

const normalizeActivityAnalyticsRow = (row, coursesById) => {
  const courseId = normalizeText(row.course_id);

  return {
    course_id: courseId,
    students: normalizeNumber(row.students),
    learning_units: normalizeNumber(row.learning_units),
    videos: normalizeNumber(row.videos),
    total_study_time_seconds: normalizeNumber(row.total_study_time_seconds),
    avg_time_to_finish_seconds: normalizeNumber(row.avg_time_to_finish_seconds),
    avg_score_rate: normalizeNumber(row.avg_score_rate),
    success_rate: normalizeNumber(row.success_rate),
    social_interactions: normalizeNumber(row.social_interactions),
    certificates_issued: normalizeNumber(row.certificates_issued),
    video_time: normalizeNumber(row.video_time),
    video_viewing_time: normalizeNumber(row.video_viewing_time),
    last_activity_at: normalizeTimestamp(row.last_activity_at),
    course_found: Boolean(courseId && coursesById.has(courseId)),
  };
};

export const normalizeLearnWorldsDatasets = (datasets) => {
  const lw_users = datasets.userRows.map(normalizeUserRow);
  const usersById = new Map(
    lw_users
      .filter((row) => Boolean(row.user_id))
      .map((row) => [row.user_id, row])
  );

  const lw_courses = datasets.courseRows.map(normalizeCourseRow);
  const coursesById = new Map(
    lw_courses
      .filter((row) => Boolean(row.course_id))
      .map((row) => [row.course_id, row])
  );

  const lw_enrollments = datasets.enrollmentRows.map((row) =>
    normalizeEnrollmentRow(row, usersById, coursesById)
  );

  const lw_course_progress = datasets.progressRows.map((row) =>
    normalizeCourseProgressRow(row, usersById, coursesById)
  );

  const lw_activity_analytics = datasets.activityAnalyticsRows.map((row) =>
    normalizeActivityAnalyticsRow(row, coursesById)
  );

  const enrollmentsByUserCourseKey = new Map(
    lw_enrollments
      .filter((row) => Boolean(row.user_id) && Boolean(row.course_id))
      .map((row) => [buildUserCourseKey(row.user_id, row.course_id), row])
  );

  const progressByUserCourseKey = new Map(
    lw_course_progress
      .filter((row) => Boolean(row.user_id) && Boolean(row.course_id))
      .map((row) => [row.progress_key, row])
  );

  const activityAnalyticsByCourseId = new Map(
    lw_activity_analytics
      .filter((row) => Boolean(row.course_id))
      .map((row) => [row.course_id, row])
  );

  return {
    lw_users,
    lw_courses,
    lw_enrollments,
    lw_course_progress,
    lw_activity_analytics,
    indexes: {
      usersById,
      coursesById,
      enrollmentsByUserCourseKey,
      progressByUserCourseKey,
      activityAnalyticsByCourseId,
    },
    dateBounds: {
      user_created_at: buildDateBounds(lw_users, 'created_at'),
      enrollment_created_at: buildDateBounds(lw_enrollments, 'enrolled_at'),
      course_created_at: buildDateBounds(lw_courses, 'created_at'),
      progress_activity_at: buildDateBounds(
        lw_course_progress.map((row) => ({
          activity_at: row.last_activity_at || row.completed_at,
        })),
        'activity_at'
      ),
    },
  };
};
