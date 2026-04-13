const normalizeValue = (value) => String(value ?? '').trim().toLowerCase();

const uniqueSorted = (values) =>
  [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));

const buildIndexes = (normalizedData) => ({
  usersById: new Map(
    normalizedData.lw_users
      .filter((row) => Boolean(row.user_id))
      .map((row) => [row.user_id, row])
  ),
  coursesById: new Map(
    normalizedData.lw_courses
      .filter((row) => Boolean(row.course_id))
      .map((row) => [row.course_id, row])
  ),
  enrollmentsByUserCourseKey: new Map(
    normalizedData.lw_enrollments
      .filter((row) => Boolean(row.user_id) && Boolean(row.course_id))
      .map((row) => [`${row.user_id}:${row.course_id}`, row])
  ),
  progressByUserCourseKey: new Map(
    normalizedData.lw_course_progress
      .filter((row) => Boolean(row.user_id) && Boolean(row.course_id))
      .map((row) => [`${row.user_id}:${row.course_id}`, row])
  ),
  activityAnalyticsByCourseId: new Map(
    normalizedData.lw_activity_analytics
      .filter((row) => Boolean(row.course_id))
      .map((row) => [row.course_id, row])
  ),
});

export const getLearnWorldsFilterOptions = (normalizedData) => ({
  courses: normalizedData.lw_courses
    .filter((course) => Boolean(course.course_id))
    .map((course) => ({
      value: course.course_id,
      label: course.course_name || course.course_id,
    }))
    .sort((left, right) => left.label.localeCompare(right.label)),
  authors: uniqueSorted(normalizedData.lw_courses.map((course) => course.author_name)),
  categories: uniqueSorted(
    normalizedData.lw_courses.flatMap((course) => course.categories || [])
  ),
  accessTypes: uniqueSorted(normalizedData.lw_courses.map((course) => course.access)),
});

export const applyLearnWorldsFilters = (normalizedData, filters) => {
  const selectedCourseIds = new Set(filters.courseIds ?? []);
  const selectedAuthors = new Set((filters.authors ?? []).map(normalizeValue));
  const selectedCategories = new Set((filters.categories ?? []).map(normalizeValue));
  const selectedAccessTypes = new Set((filters.accessTypes ?? []).map(normalizeValue));

  const hasCourseScopedFilters =
    selectedCourseIds.size > 0 ||
    selectedAuthors.size > 0 ||
    selectedCategories.size > 0 ||
    selectedAccessTypes.size > 0;

  if (!hasCourseScopedFilters) {
    return normalizedData;
  }

  const lw_courses = normalizedData.lw_courses.filter((course) => {
    if (selectedCourseIds.size > 0 && !selectedCourseIds.has(course.course_id)) {
      return false;
    }

    if (
      selectedAuthors.size > 0 &&
      !selectedAuthors.has(normalizeValue(course.author_name))
    ) {
      return false;
    }

    if (
      selectedAccessTypes.size > 0 &&
      !selectedAccessTypes.has(normalizeValue(course.access))
    ) {
      return false;
    }

    if (selectedCategories.size > 0) {
      const categoryMatch = (course.categories || []).some((category) =>
        selectedCategories.has(normalizeValue(category))
      );

      if (!categoryMatch) {
        return false;
      }
    }

    return true;
  });

  const allowedCourseIds = new Set(lw_courses.map((course) => course.course_id).filter(Boolean));

  const lw_enrollments = normalizedData.lw_enrollments.filter((row) =>
    row.course_id && allowedCourseIds.has(row.course_id)
  );

  const lw_course_progress = normalizedData.lw_course_progress.filter((row) =>
    row.course_id && allowedCourseIds.has(row.course_id)
  );

  const lw_activity_analytics = normalizedData.lw_activity_analytics.filter((row) =>
    row.course_id && allowedCourseIds.has(row.course_id)
  );

  const allowedUserIds = new Set(
    [...lw_enrollments, ...lw_course_progress]
      .map((row) => row.user_id)
      .filter(Boolean)
  );

  const lw_users = normalizedData.lw_users.filter((user) =>
    user.user_id && allowedUserIds.has(user.user_id)
  );

  return {
    ...normalizedData,
    lw_users,
    lw_courses,
    lw_enrollments,
    lw_course_progress,
    lw_activity_analytics,
    indexes: buildIndexes({
      lw_users,
      lw_courses,
      lw_enrollments,
      lw_course_progress,
      lw_activity_analytics,
    }),
  };
};
