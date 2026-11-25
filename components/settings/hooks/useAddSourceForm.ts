/**
 * Form hook for AddSourceModal
 */

'use client';

import { useMemo, useState } from 'react';
import type { VideoSource } from '@/lib/types';

interface UseAddSourceFormProps {
    isOpen: boolean;
    existingIds: string[];
    onAdd: (source: VideoSource) => void;
    onClose: () => void;
    initialValues?: VideoSource | null;
}

interface AddSourceFormValues {
    name: string;
    customId: string;
    idManuallyEdited: boolean;
    url: string;
    error: string;
}

function createFormValues(isOpen: boolean, initialValues?: VideoSource | null): AddSourceFormValues {
    if (isOpen && initialValues) {
        return {
            name: initialValues.name,
            customId: initialValues.id,
            idManuallyEdited: true,
            url: initialValues.baseUrl,
            error: '',
        };
    }

    return {
        name: '',
        customId: '',
        idManuallyEdited: false,
        url: '',
        error: '',
    };
}

function generateIdFromName(name: string): string {
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return slug || `custom-${Date.now().toString(36)}`;
}

export function useAddSourceForm({ isOpen, existingIds, onAdd, onClose, initialValues }: UseAddSourceFormProps) {
    const formSession = useMemo(() => ({ isOpen, initialValues }), [isOpen, initialValues]);
    const [formState, setFormState] = useState(() => ({
        session: formSession,
        values: createFormValues(isOpen, initialValues),
    }));
    const values = formState.session === formSession
        ? formState.values
        : createFormValues(isOpen, initialValues);
    const { name, customId, idManuallyEdited, url, error } = values;

    const updateForm = (patch: Partial<AddSourceFormValues>) => {
        setFormState((current) => {
            const currentValues = current.session === formSession
                ? current.values
                : createFormValues(isOpen, initialValues);
            return {
                session: formSession,
                values: { ...currentValues, ...patch },
            };
        });
    };

    const handleNameChange = (newName: string) => {
        updateForm({
            name: newName,
            ...(!idManuallyEdited && !initialValues
                ? { customId: generateIdFromName(newName) }
                : {}),
        });
    };

    const handleIdChange = (newId: string) => {
        updateForm({ idManuallyEdited: true, customId: newId });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        updateForm({ error: '' });

        if (!name.trim() || !url.trim()) {
            updateForm({ error: '请填写所有字段' });
            return;
        }

        try {
            new URL(url);
        } catch {
            updateForm({ error: '请输入有效的 URL' });
            return;
        }

        const id = customId.trim() || generateIdFromName(name);

        if (!initialValues && existingIds.includes(id)) {
            updateForm({ error: '此源 ID 已存在，请修改源 ID' });
            return;
        }

        const newSource: VideoSource = {
            id,
            name: name.trim(),
            baseUrl: url.trim(),
            searchPath: initialValues?.searchPath || '',
            detailPath: initialValues?.detailPath || '',
            enabled: initialValues?.enabled ?? true,
            priority: initialValues?.priority || existingIds.length + 1,
        };

        onAdd(newSource);
        onClose();
    };

    return {
        name,
        setName: handleNameChange,
        customId,
        setCustomId: handleIdChange,
        url,
        setUrl: (nextUrl: string) => updateForm({ url: nextUrl }),
        error,
        handleSubmit,
        isEditing: !!initialValues,
    };
}
