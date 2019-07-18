import csv
import json
import pickle
import logging
from itertools import repeat, takewhile

logger = logging.getLogger('dnf utils')


def dump_it_to_pickle(fname, pyobj):
    """Save pyobj to fname as pickle"""
    logger.info('Dumping to pickle file %s' % fname)
    with open(fname, 'wb') as po:
        pickle.dump(obj=pyobj, file=po)
    logger.info('Finished dumping to pickle')


def dump_it_to_json(fname, pyobj):
    """Save pyobj to fname as json"""
    logger.info('Dumping to json file %s' % fname)
    with open(fname, 'w') as json_out:
        json.dump(pyobj, json_out)
    logger.info('Finished dumping to pickle')


def dump_it_to_csv(fname, pyobj, separator=',', header=None):
    """Save pyobj to fname as csv file"""
    logger.info('Dumping to csv file %s' % fname)
    if header:
        logger.info('Writing csv header')
        with open(fname, 'w') as fo:
            fo.write(','.join(header)+'\n')
    with open(fname, 'a', newline='') as csvf:
        wrtr = csv.writer(csvf, delimiter=separator)
        wrtr.writerows(pyobj)
    logger.info('Finished dumping to csv')


def pickle_open(fname):
    """Open pickle fname and return the contianed object"""
    logger.info('Loading pickle file %s' % fname)
    with open(fname, 'rb') as pi:
        pkl = pickle.load(file=pi)
    logger.info('Finished loading pickle file')
    return pkl


def json_open(fname):
    """Open json fname and return the object"""
    logger.info('Loading json file %s' % fname)
    with open(fname, 'r') as jo:
        js = json.load(fp=jo)
    logger.info('Finished loading json file')
    return js


def rawincount(filename):
    """Count lines in filename

    filename: str
        Path to file to count lines in

    Returns
    -------
    line_count: int
        The number of lines in the file 'filename'
    """
    f = open(filename, 'rb')
    bufgen = takewhile(lambda x: x, (f.read(1024*1024) for _ in repeat(None)))
    return sum(buf.count(b'\n') for buf in bufgen)
