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
        deleteItem
    };
}
