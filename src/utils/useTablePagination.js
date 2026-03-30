import { useEffect, useMemo, useState } from "react";

const useTablePagination = (items, pageSize, resetDependencies = []) => {
  const [currentPage, setCurrentPage] = useState(1);
  const resetDependenciesKey = JSON.stringify(resetDependencies);

  const paginationState = useMemo(() => {
    const totalItems = items.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const currentPageSafe = Math.min(Math.max(currentPage, 1), totalPages);
    const startIndex = (currentPageSafe - 1) * pageSize;
    const endIndex = startIndex + pageSize;

    return {
      totalPages,
      currentPageSafe,
      pageStart: totalItems ? startIndex + 1 : 0,
      pageEnd: Math.min(endIndex, totalItems),
      paginatedItems: items.slice(startIndex, endIndex),
    };
  }, [currentPage, items, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [resetDependenciesKey]);

  useEffect(() => {
    if (currentPage > paginationState.totalPages) {
      setCurrentPage(paginationState.totalPages);
    }
  }, [currentPage, paginationState.totalPages]);

  return {
    ...paginationState,
    setCurrentPage,
  };
};

export default useTablePagination;
