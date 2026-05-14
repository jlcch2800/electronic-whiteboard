import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, X, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface SearchFilters {
    startDate: string;
    endDate: string;
    status: string;
    department: string;
    costCenter: string;
    content: string;
    requester: string;
    workOrderId: string;
    handler: string;
    quoteHandler: string;
    vendor: string;
    amount: string; // 'lte20k' | 'gt20k' | ''
    projectOrderId: string;
    procurement: string;
    acceptHandler: string;
    customSearch: string;
}

export const defaultFilters: SearchFilters = {
    startDate: '',
    endDate: '',
    status: '',
    department: '',
    costCenter: '',
    content: '',
    requester: '',
    workOrderId: '',
    handler: '',
    quoteHandler: '',
    vendor: '',
    amount: '',
    projectOrderId: '',
    procurement: '',
    acceptHandler: '',
    customSearch: ''
};

interface AdvancedSearchFilterProps {
    onSearch: (filters: SearchFilters) => void;
    onReset: () => void;
}

export function AdvancedSearchFilter({ onSearch, onReset }: AdvancedSearchFilterProps) {
    const [filters, setFilters] = useState<SearchFilters>(defaultFilters);
    const [expanded, setExpanded] = useState(false);

    const handleChange = (key: keyof SearchFilters, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const handleSearch = () => {
        onSearch(filters);
    };

    const handleReset = () => {
        setFilters(defaultFilters);
        onReset();
    };

    // 按下 Enter 鍵時觸發搜尋
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    return (
        <div className="bg-white dark:bg-slate-950 border rounded-lg shadow-sm mb-6 p-4">
            <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                    <label className="text-sm font-medium text-muted-foreground mb-1 block">自訂搜尋 (關鍵字)</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="搜尋編號、部門、承辦人或內容..."
                            value={filters.customSearch}
                            onChange={(e) => handleChange('customSearch', e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="pl-9"
                        />
                    </div>
                </div>

                <Button onClick={handleSearch} className="bg-green-600 hover:bg-green-700 text-white">
                    <Search className="w-4 h-4 mr-2" />
                    搜尋
                </Button>
                <Button variant="outline" onClick={handleReset}>
                    <X className="w-4 h-4 mr-2" />
                    清除
                </Button>
                <Button variant="ghost" onClick={() => setExpanded(!expanded)} className="text-muted-foreground">
                    {expanded ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
                    {expanded ? '收起進階條件' : '展開進階條件'}
                </Button>
            </div>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mt-4 pt-4 border-t" onKeyDown={handleKeyDown}>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground mb-1 block">開始日期</label>
                                <Input type="date" value={filters.startDate} onChange={(e) => handleChange('startDate', e.target.value)} />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground mb-1 block">結束日期</label>
                                <Input type="date" value={filters.endDate} onChange={(e) => handleChange('endDate', e.target.value)} />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground mb-1 block">工單編號</label>
                                <Input value={filters.workOrderId} onChange={(e) => handleChange('workOrderId', e.target.value)} placeholder="工單編號" />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground mb-1 block">開單部門</label>
                                <Input value={filters.department} onChange={(e) => handleChange('department', e.target.value)} placeholder="開單部門" />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground mb-1 block">開單人</label>
                                <Input value={filters.requester} onChange={(e) => handleChange('requester', e.target.value)} placeholder="開單人" />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground mb-1 block">成本中心</label>
                                <Input value={filters.costCenter} onChange={(e) => handleChange('costCenter', e.target.value)} placeholder="成本中心" />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground mb-1 block">維修狀態</label>
                                <Input value={filters.status} onChange={(e) => handleChange('status', e.target.value)} placeholder="狀態" />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground mb-1 block">承辦人</label>
                                <Input value={filters.handler} onChange={(e) => handleChange('handler', e.target.value)} placeholder="承辦人" />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground mb-1 block">維修內容</label>
                                <Input value={filters.content} onChange={(e) => handleChange('content', e.target.value)} placeholder="維修內容" />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground mb-1 block">報價承辦人</label>
                                <Input value={filters.quoteHandler} onChange={(e) => handleChange('quoteHandler', e.target.value)} placeholder="報價承辦人" />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground mb-1 block">廠商</label>
                                <Input value={filters.vendor} onChange={(e) => handleChange('vendor', e.target.value)} placeholder="廠商" />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground mb-1 block">金額</label>
                                <Select value={filters.amount || 'all'} onValueChange={(val) => handleChange('amount', val === 'all' ? '' : val)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="不限" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">不限</SelectItem>
                                        <SelectItem value="lte20k">小於等於2萬</SelectItem>
                                        <SelectItem value="gt20k">大於2萬</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground mb-1 block">工程單編號</label>
                                <Input value={filters.projectOrderId} onChange={(e) => handleChange('projectOrderId', e.target.value)} placeholder="工程單編號" />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground mb-1 block">採購組姓名</label>
                                <Input value={filters.procurement} onChange={(e) => handleChange('procurement', e.target.value)} placeholder="採購組姓名" />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground mb-1 block">驗收承辦人</label>
                                <Input value={filters.acceptHandler} onChange={(e) => handleChange('acceptHandler', e.target.value)} placeholder="驗收承辦人" />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
