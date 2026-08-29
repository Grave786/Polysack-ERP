import { useState, useEffect, useCallback } from 'react';
import axiosInstance from '../api/axiosInstance';
import toast from 'react-hot-toast';

export function useResourceApi(resourcePath, initialParams = {}) {
    const [data, setData] = useState([]);
    const [pagination, setPagination] = useState({
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 1
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState(initialParams.search || '');
    const [statusFilter, setStatusFilter] = useState(initialParams.status || 'All Statuses');
    const [page, setPage] = useState(initialParams.page || 1);
    const [limit, setLimit] = useState(initialParams.limit || 10);

    const fetchData = useCallback(async () => {
        if (!resourcePath) return;
        setIsLoading(true);
        setError(null);
        try {
            const params = {};
            if (search.trim()) params.search = search.trim();
            if (page) params.page = page;
            if (limit) params.limit = limit;
            
            const isAll = !statusFilter || statusFilter === 'All Statuses' || statusFilter === 'All' || statusFilter === 'ALL';
            if (!isAll) {
                params.status = statusFilter;
            }

            const response = await axiosInstance.get(resourcePath, { params });
            const result = response.data;

            if (result.success) {
                const listData = Array.isArray(result.data) ? [...result.data] : [];
                setData(listData);

                if (result.pagination) {
                    setPagination({ ...result.pagination });
                } else {
                    setPagination({
                        total: listData.length,
                        page: page,
                        limit: limit,
                        totalPages: Math.ceil(listData.length / limit) || 1
                    });
                }
            } else {
                setError(result.message || 'Failed to fetch data');
            }
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Error loading resources');
        } finally {
            setIsLoading(false);
        }
    }, [resourcePath, search, page, limit, statusFilter]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    /**
     * Create Item
     * Sends POST request to resourcePath, awaits fetchData() to refresh table state, then returns result.
     */
    const createItem = async (itemData) => {
        if (!resourcePath) return { success: false, error: 'Invalid resource path' };
        try {
            setIsLoading(true);
            const response = await axiosInstance.post(resourcePath, itemData);
            const result = response.data;

            if (result.success) {
                toast.success(result.message || 'Record created successfully!');
                await fetchData();
                return { success: true, data: result.data };
            } else {
                throw new Error(result.message || 'Failed to create record');
            }
        } catch (err) {
            const errMsg = err.response?.data?.message || err.message || 'Failed to create record';
            toast.error(errMsg);
            return { success: false, error: errMsg };
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Update Item
     * Sends PUT request to resourcePath/:id, awaits fetchData() to refresh table state, then returns result.
     */
    const updateItem = async (id, itemData) => {
        if (!resourcePath || !id) return { success: false, error: 'Invalid ID or resource path' };
        try {
            setIsLoading(true);
            const response = await axiosInstance.put(`${resourcePath}/${id}`, itemData);
            const result = response.data;

            if (result.success) {
                toast.success(result.message || 'Record updated successfully!');
                await fetchData();
                return { success: true, data: result.data };
            } else {
                throw new Error(result.message || 'Failed to update record');
            }
        } catch (err) {
            const errMsg = err.response?.data?.message || err.message || 'Failed to update record';
            toast.error(errMsg);
            return { success: false, error: errMsg };
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Delete / Deactivate Item
     * Sends DELETE request (soft delete setting isActive: false), awaits fetchData() to refresh table state.
     */
    const deleteItem = async (id) => {
        if (!resourcePath || !id) return { success: false, error: 'Invalid ID or resource path' };
        try {
            setIsLoading(true);
            const response = await axiosInstance.delete(`${resourcePath}/${id}`);
            const result = response.data;

            if (result.success) {
                toast.success('Record deactivated successfully');
                await fetchData();
                return { success: true };
            } else {
                throw new Error(result.message || 'Failed to deactivate record');
            }
        } catch (err) {
            const errMsg = err.response?.data?.message || err.message || 'Failed to deactivate record';
            toast.error(errMsg);
            return { success: false, error: errMsg };
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Bulk Delete / Deactivate Items
     * Sends POST `${resourcePath}/bulk-delete` with { ids } (or parallel fallback)
     */
    const bulkDeleteItems = async (ids) => {
        if (!resourcePath || !Array.isArray(ids) || ids.length === 0) {
            return { success: false, error: 'No items selected' };
        }
        try {
            setIsLoading(true);
            let response;
            try {
                response = await axiosInstance.post(`${resourcePath}/bulk-delete`, { ids });
            } catch (postErr) {
                // If 404/405 endpoint not on backend, fallback to per-item delete
                if (postErr.response?.status === 404 || postErr.response?.status === 405) {
                    let successCount = 0;
                    let lastErrMsg = null;
                    for (const singleId of ids) {
                        try {
                            await axiosInstance.delete(`${resourcePath}/${singleId}`);
                            successCount++;
                        } catch (sErr) {
                            lastErrMsg = sErr.response?.data?.message || sErr.message;
                        }
                    }
                    if (successCount > 0) {
                        toast.success(`${successCount} record(s) deactivated successfully.`);
                        await fetchData();
                        return { success: true, count: successCount };
                    } else {
                        throw new Error(lastErrMsg || 'Failed to deactivate selected records');
                    }
                } else {
                    throw postErr;
                }
            }

            const result = response.data;
            if (result.success) {
                const deletedCount = result.deletedCount !== undefined ? result.deletedCount : (result.data?.deletedCount !== undefined ? result.data.deletedCount : ids.length);
                const skippedCount = result.skippedCount || result.data?.skippedCount || 0;
                const skippedReason = result.skippedReason || result.data?.skippedReason || '';

                if (skippedCount > 0 && skippedReason) {
                    toast.success(`${deletedCount} record(s) deleted. ${skippedCount} skipped (${skippedReason}).`);
                } else if (skippedCount > 0) {
                    toast.success(`${deletedCount} record(s) deleted, ${skippedCount} skipped.`);
                } else {
                    toast.success(`${deletedCount} record(s) deactivated successfully.`);
                }

                await fetchData();
                return { success: true, count: deletedCount };
            } else {
                throw new Error(result.message || 'Failed to delete selected records');
            }
        } catch (err) {
            const errMsg = err.response?.data?.message || err.message || 'Failed to delete selected records';
            toast.error(errMsg);
            return { success: false, error: errMsg };
        } finally {
            setIsLoading(false);
        }
    };

    return {
        data,
        pagination,
        isLoading,
        error,
        search,
        setSearch: (newSearch) => {
            setSearch(newSearch);
            setPage(1); // Reset to page 1 on new search
        },
        statusFilter,
        setStatusFilter: (newStatus) => {
            setStatusFilter(newStatus);
            setPage(1);
        },
        page,
        setPage,
        limit,
        setLimit,
        refetch: fetchData,
        createItem,
        updateItem,
        deleteItem,
        bulkDeleteItems
    };
}
